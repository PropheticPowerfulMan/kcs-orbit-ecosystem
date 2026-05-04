from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analytics, auth, chat, messaging, notifications, workflows
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app import models  # noqa: F401
from app.models.user import Role, User
from app.core.security import get_password_hash
from app.workers.scheduler import scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_admin()
    if settings.scheduler_enabled:
        scheduler.start()
    try:
        yield
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)


def seed_default_admin() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@school.edu").first()
        if not admin:
            db.add(
                User(
                    full_name="System Administrator",
                    email="admin@school.edu",
                    hashed_password=get_password_hash("Admin@123"),
                    role=Role.ADMIN,
                    department="Administration",
                )
            )
        else:
            admin.full_name = "System Administrator"
            admin.hashed_password = get_password_hash("Admin@123")
            admin.role = Role.ADMIN
            admin.department = "Administration"
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
app.include_router(messaging.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(workflows.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)


@app.get("/")
def health():
    return {"status": "ok", "service": settings.app_name}
