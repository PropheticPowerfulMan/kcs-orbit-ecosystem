import json
import random
import string
from urllib import error, request

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.analytics import ActivityLog
from app.models.user import Role, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse


router = APIRouter(prefix="/auth", tags=["Auth"])


def normalize_access_code(value: str | None) -> str:
    return (value or "").strip().upper()


def savanex_auth_is_enabled() -> bool:
    return bool(settings.savanex_api_url.strip())


def generate_access_code(role: Role) -> str:
    prefix = {
        Role.ADMIN: "ADM",
        Role.TEACHER: "TCH",
        Role.STAFF: "STF",
    }[role]
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ACC-{prefix}-{suffix}"


def generate_unique_access_code(db: Session, role: Role) -> str:
    for _ in range(10):
        candidate = generate_access_code(role)
        existing = db.query(User).filter(User.access_code == candidate).first()
        if not existing:
            return candidate
    return f"ACC-{role.value[:3].upper()}-{int(random.random() * 1_000_000):06d}"


def map_savanex_role(role: str | None) -> Role | None:
    normalized = (role or "").strip().lower()
    if normalized == "admin":
        return Role.ADMIN
    if normalized == "teacher":
        return Role.TEACHER
    if normalized == "employee":
        return Role.STAFF
    return None


def default_department_for_role(role: Role) -> str:
    if role == Role.TEACHER:
        return "Academics"
    if role == Role.ADMIN:
        return "Administration"
    return "Operations"


def authenticate_with_savanex(identifier: str, password: str) -> dict | None:
    if not savanex_auth_is_enabled():
        return None

    base_url = settings.savanex_api_url.rstrip("/")
    login_url = f"{base_url}{settings.savanex_login_path}"
    body = json.dumps({"username": identifier, "password": password}).encode("utf-8")
    req = request.Request(login_url, data=body, headers={"Content-Type": "application/json"}, method="POST")

    try:
        with request.urlopen(req, timeout=settings.savanex_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code in (400, 401, 403, 404):
            return None
        raise HTTPException(status_code=503, detail="External staff authentication is temporarily unavailable") from exc
    except Exception as exc:  # pragma: no cover - integration boundary
        raise HTTPException(status_code=503, detail="External staff authentication is temporarily unavailable") from exc

    external_user = payload.get("user") or {}
    mapped_role = map_savanex_role(external_user.get("role"))
    if mapped_role is None:
        return None

    access_code = normalize_access_code(external_user.get("access_code")) or normalize_access_code(identifier)
    full_name = (external_user.get("full_name") or "").strip() or "SAVANEX User"
    email = (external_user.get("email") or "").strip().lower()
    if not email:
        email = f"{access_code.lower()}@savanex.local"

    return {
        "full_name": full_name,
        "email": email,
        "access_code": access_code or None,
        "role": mapped_role,
        "department": default_department_for_role(mapped_role),
    }


def upsert_external_user(db: Session, external_user: dict, password: str) -> User:
    email = external_user["email"]
    access_code = external_user.get("access_code")

    user = db.query(User).filter(
        or_(func.lower(User.email) == email.lower(), User.access_code == access_code)
    ).first()

    password_hash = get_password_hash(password)
    if user:
        user.full_name = external_user["full_name"]
        user.email = email
        user.access_code = access_code
        user.role = external_user["role"]
        user.department = external_user["department"]
        user.hashed_password = password_hash
    else:
        user = User(
            full_name=external_user["full_name"],
            email=email,
            access_code=access_code,
            hashed_password=password_hash,
            role=external_user["role"],
            department=external_user["department"],
        )
        db.add(user)

    db.flush()
    return user


@router.post("/register", response_model=UserResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    requested_access_code = normalize_access_code(payload.access_code)
    if requested_access_code:
        duplicate_access_code = db.query(User).filter(User.access_code == requested_access_code).first()
        if duplicate_access_code:
            raise HTTPException(status_code=400, detail="Access code already registered")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        access_code=requested_access_code or generate_unique_access_code(db, payload.role),
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(user)
    db.add(ActivityLog(actor_id=None, event_type="user_registered", department=payload.department))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    identifier = payload.identifier or ""
    normalized_email = identifier.strip().lower()
    normalized_access_code = normalize_access_code(identifier)

    user = db.query(User).filter(
        or_(func.lower(User.email) == normalized_email, User.access_code == normalized_access_code)
    ).first()

    if user and verify_password(payload.password, user.hashed_password):
        token = create_access_token(subject=str(user.id))
        db.add(ActivityLog(actor_id=user.id, event_type="user_login", department=user.department))
        db.commit()
        return TokenResponse(access_token=token)

    external_user = authenticate_with_savanex(identifier, payload.password)
    if external_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user = upsert_external_user(db, external_user, payload.password)

    token = create_access_token(subject=str(user.id))
    db.add(ActivityLog(actor_id=user.id, event_type="user_login", department=user.department))
    db.commit()
    return TokenResponse(access_token=token)
