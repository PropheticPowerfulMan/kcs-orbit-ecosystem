from datetime import datetime
from app.models.password_reset import PasswordResetToken
from pydantic import BaseModel
from app.services.password_recovery import request_local_recovery, reset_local_password, validate_new_password
import json
import random
import string
from urllib import error, parse, request

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.ecosystem_access import ensure_ecosystem_access
from app.core.security import create_access_token, get_current_user, get_password_hash, verify_password
from app.db.session import get_db
from app.models.analytics import ActivityLog
from app.models.user import Role, User
from app.integrations.orbit import fetch_shared_directory
from app.schemas.auth import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse


router = APIRouter(prefix="/auth", tags=["Auth"])


def normalize_access_code(value: str | None) -> str:
    return (value or "").strip().upper()


def edupay_auth_is_enabled() -> bool:
    return bool(settings.edupay_api_url.strip())


def savanex_auth_is_enabled() -> bool:
    return bool(settings.savanex_api_url.strip())


def generate_access_code(role: Role) -> str:
    prefix = {
        Role.ADMIN: "ADM",
        Role.TEACHER: "TCH",
        Role.STAFF: "STF",
        Role.PARENT: "PAR",
        Role.STUDENT: "STU",
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


def map_savanex_role(role: str | None, employee_type: str | None = None) -> Role | None:
    normalized = (role or "").strip().lower()
    normalized_employee_type = (employee_type or "").strip().lower().replace("_", " ").replace("-", " ")
    if normalized == "admin":
        return Role.ADMIN
    if normalized == "teacher" or normalized_employee_type == "teacher":
        return Role.TEACHER
    if normalized_employee_type in {"administrative", "administrative staff", "leadership"}:
        return Role.STAFF
    return None


def map_edupay_role(role: str | None) -> Role | None:
    normalized = (role or "").strip().upper()
    if normalized in {"SUPER_ADMIN", "OWNER", "ADMIN"}:
        return Role.ADMIN
    if normalized in {"FINANCIAL_MANAGER", "ACCOUNTANT", "CASHIER", "HR_MANAGER", "AUDITOR"}:
        return Role.STAFF
    return None


def default_department_for_role(role: Role) -> str:
    if role == Role.TEACHER:
        return "Academics"
    if role == Role.ADMIN:
        return "Administration"
    if role == Role.PARENT:
        return "Family Relations"
    if role == Role.STUDENT:
        return "Student Life"
    return "Operations"


def is_shared_orbit_identity(identifier: str) -> bool:
    normalized_email = identifier.strip().lower()
    normalized_code = normalize_access_code(identifier)
    try:
        directory = fetch_shared_directory()
    except Exception:
        return False

    for collection in ("parents", "students", "teachers"):
        for entity in directory.get(collection) or []:
            email = str(entity.get("email") or "").strip().lower()
            access_code = normalize_access_code(entity.get("accessCode"))
            if (normalized_email and email == normalized_email) or (normalized_code and access_code == normalized_code):
                return True
    return False

def authenticate_with_edupay(identifier: str, password: str) -> dict | None:
    if not edupay_auth_is_enabled():
        return None

    base_url = settings.edupay_api_url.rstrip("/")
    login_url = f"{base_url}{settings.edupay_login_path}"
    body = json.dumps({"identifier": identifier, "password": password}).encode("utf-8")
    req = request.Request(login_url, data=body, headers={"Content-Type": "application/json"}, method="POST")

    try:
        with request.urlopen(req, timeout=settings.edupay_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code in (400, 401, 403, 404):
            return None
        raise HTTPException(status_code=503, detail="EduPay authentication is temporarily unavailable") from exc
    except Exception as exc:  # pragma: no cover - integration boundary
        raise HTTPException(status_code=503, detail="EduPay authentication is temporarily unavailable") from exc

    mapped_role = map_edupay_role(payload.get("role"))
    if mapped_role is None:
        return None

    access_code = normalize_access_code(payload.get("accessCode")) or normalize_access_code(identifier)
    full_name = (payload.get("fullName") or "").strip() or "EduPay User"
    email = (payload.get("email") or "").strip().lower()
    if not email:
        if "@" in identifier:
            email = identifier.strip().lower()
        else:
            email = f"{access_code.lower()}@edupay.local"

    return {
        "full_name": full_name,
        "email": email,
        "access_code": access_code or None,
        "role": mapped_role,
        "department": default_department_for_role(mapped_role),
    }


def authenticate_with_savanex(identifier: str, password: str) -> dict | None:
    if not savanex_auth_is_enabled():
        return None

    base_url = settings.savanex_api_url.rstrip("/")
    login_url = f"{base_url}{settings.savanex_login_path}"
    body = json.dumps({"identifier": identifier, "password": password}).encode("utf-8")
    req = request.Request(login_url, data=body, headers={"Content-Type": "application/json", "x-api-key": settings.kcs_orbit_api_key}, method="POST")

    try:
        with request.urlopen(req, timeout=settings.savanex_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code in (400, 401, 403, 404):
            return None
        raise HTTPException(status_code=503, detail="External shared authentication is temporarily unavailable") from exc
    except Exception as exc:  # pragma: no cover - integration boundary
        raise HTTPException(status_code=503, detail="External shared authentication is temporarily unavailable") from exc

    external_user = payload.get("user") or {}
    mapped_role = map_savanex_role(external_user.get("role"), external_user.get("employee_type"))
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


def authenticate_with_nexus(identifier: str, password: str) -> dict | None:
    if not settings.kcs_nexus_api_url:
        return None
    login_url = f"{settings.kcs_nexus_api_url.rstrip('/')}{settings.kcs_nexus_login_path}"
    body = json.dumps({"email": identifier, "password": password}).encode("utf-8")
    req = request.Request(login_url, data=body, headers={"Content-Type": "application/json", "x-kcs-local-auth-only": "true"}, method="POST")
    try:
        with request.urlopen(req, timeout=settings.kcs_nexus_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code in (400, 401, 403, 404):
            return None
        raise HTTPException(status_code=503, detail="Nexus authentication is temporarily unavailable") from exc
    except Exception:
        return None
    external_user = (payload.get("data") or {}).get("user") or {}
    mapped_role = map_savanex_role(external_user.get("role"), external_user.get("employee_type"))
    if mapped_role is None:
        return None
    access_code = normalize_access_code(external_user.get("accessCode")) or normalize_access_code(identifier)
    email = (external_user.get("email") or "").strip().lower() or f"{access_code.lower()}@nexus.local"
    full_name = " ".join(filter(None, [external_user.get("lastName"), external_user.get("firstName")])) or "Nexus User"
    return {"full_name": full_name, "email": email, "access_code": access_code or None, "role": mapped_role, "department": default_department_for_role(mapped_role)}

def upsert_external_user(db: Session, external_user: dict, password: str) -> User:
    email = external_user["email"]
    access_code = external_user.get("access_code")

    user = db.query(User).filter(
        or_(func.lower(User.email) == email.lower(), User.access_code == access_code)
    ).first()

    password_hash = get_password_hash(password)
    if user:
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Use the password of this EduSync account")
        user.full_name = external_user["full_name"]
        user.email = email
        user.access_code = access_code
        user.role = external_user["role"]
        user.department = external_user["department"]
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


@router.get("/me", response_model=UserResponse)
def current_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=UserResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    del payload, db
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="EduSync consumes identities provisioned by SAVANEX or EduPay and cannot create user accounts.",
    )


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    request_local_recovery(db, str(payload.email).strip().lower())
    return {"message":"If this account exists, an EduSync-only recovery link has been sent by email."}

class LocalResetRequest(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
def reset_password(payload: LocalResetRequest, db: Session = Depends(get_db)):
    reset_local_password(db,payload.token,payload.new_password)
    return {"message":"EduSync password reset. Other applications are unchanged."}

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    identifier = payload.identifier or ""
    normalized_email = identifier.strip().lower()
    normalized_access_code = normalize_access_code(identifier)

    user = db.query(User).filter(
        or_(func.lower(User.email) == normalized_email, User.access_code == normalized_access_code)
    ).first()

    if user and verify_password(payload.password, user.hashed_password):
        ensure_ecosystem_access([user.email,user.access_code])
        token = create_access_token(subject=str(user.id))
        db.add(ActivityLog(actor_id=user.id, event_type="user_login", department=user.department))
        db.commit()
        return TokenResponse(access_token=token)

    if user:
        raise HTTPException(status_code=401, detail="Invalid EduSync credentials")

    external_user = authenticate_with_nexus(identifier, payload.password)
    if external_user is None:
        external_user = authenticate_with_edupay(identifier, payload.password)
    if external_user is None:
        external_user = authenticate_with_savanex(identifier, payload.password)

    if external_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user = upsert_external_user(db, external_user, payload.password)

    ensure_ecosystem_access([user.email,user.access_code])
    token = create_access_token(subject=str(user.id))
    db.add(ActivityLog(actor_id=user.id, event_type="user_login", department=user.department))
    db.commit()
    return TokenResponse(access_token=token)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_new_password(payload.new_password)
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="The new password must be different")
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id==current_user.id,PasswordResetToken.used_at.is_(None)).update({"used_at":datetime.utcnow()})
    db.add(ActivityLog(actor_id=current_user.id, event_type="password_changed", department=current_user.department))
    db.commit()
    return {"message": "Password changed successfully"}


@router.get('/personal-portrait')
def personal_portrait(current_user: User = Depends(get_current_user)):
    # Access codes are unique institutional identifiers; names/emails are never guessed.
    import base64
    from fastapi.responses import JSONResponse
    identity = parse.quote(current_user.access_code or '', safe='')
    if not identity:
        return JSONResponse({'image': None}, headers={'Cache-Control': 'private, no-store'})
    url = settings.kcs_nexus_api_url.rstrip('/').removesuffix('/api') + '/api/personal-portraits/' + identity + '?kind=accessCode'
    query = request.Request(url, headers={'x-api-key': settings.kcs_orbit_api_key, 'x-app-slug': 'EDUSYNCAI'})
    try:
        with request.urlopen(query, timeout=8) as response:
            if response.status == 204:
                return JSONResponse({'image': None}, headers={'Cache-Control': 'private, no-store'})
            mime = response.headers.get_content_type()
            data = response.read(1_500_001)
            if mime not in ('image/jpeg', 'image/png', 'image/webp') or len(data) > 1_500_000:
                raise ValueError('Invalid personal portrait')
            return JSONResponse({'image': 'data:' + mime + ';base64,' + base64.b64encode(data).decode('ascii')}, headers={'Cache-Control': 'private, no-store'})
    except (error.URLError, ValueError, TimeoutError):
        raise HTTPException(status_code=503, detail='Personal portrait temporarily unavailable')
