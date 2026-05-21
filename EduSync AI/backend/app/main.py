from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

from app.api.routes import analytics, auth, chat, directory, messaging, notifications, registry, workflows
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app import models  # noqa: F401
from app.models.user import Role, User
from app.core.security import get_password_hash, verify_password
from app.workers.scheduler import flush_orbit_outbox, scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_user_identity_columns()
    seed_default_admin()
    if settings.scheduler_enabled:
        flush_orbit_outbox()
        scheduler.start()
    try:
        yield
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)


def ensure_user_identity_columns() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    statements: list[str] = []
    if "access_code" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN access_code VARCHAR(32)")

    def ensure_role_values(connection: Connection) -> None:
        if connection.dialect.name != "postgresql":
            return

        for role_value in (Role.PARENT.value, Role.STUDENT.value):
            connection.execute(text(f"ALTER TYPE role ADD VALUE IF NOT EXISTS '{role_value}'"))

    if not statements:
        with engine.begin() as connection:
            ensure_role_values(connection)
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_access_code_unique ON users (access_code) WHERE access_code IS NOT NULL"))
        return

    with engine.begin() as connection:
        ensure_role_values(connection)
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_access_code_unique ON users (access_code) WHERE access_code IS NOT NULL"))


def seed_default_admin() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@school.edu").first()
        if not admin:
            db.add(
                User(
                    full_name="System Administrator",
                    email="admin@school.edu",
                    access_code="ACC-ADM-EDUSYNC",
                    hashed_password=get_password_hash("Admin@123"),
                    role=Role.ADMIN,
                    department="Administration",
                )
            )
            db.commit()
            return

        changed = False
        expected_values = {
            "full_name": "System Administrator",
            "role": Role.ADMIN,
            "department": "Administration",
            "access_code": "ACC-ADM-EDUSYNC",
        }
        for field, expected_value in expected_values.items():
            if getattr(admin, field) != expected_value:
                setattr(admin, field, expected_value)
                changed = True

        if not verify_password("Admin@123", admin.hashed_password):
            admin.hashed_password = get_password_hash("Admin@123")
            changed = True

        if changed:
            db.commit()
    finally:
        db.close()


app = FastAPI(title=settings.app_name, debug=settings.app_debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(directory.router, prefix=settings.api_prefix)
app.include_router(messaging.router, prefix=settings.api_prefix)
app.include_router(registry.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(workflows.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)


@app.get("/")
def health():
    return {"status": "ok", "service": settings.app_name}
