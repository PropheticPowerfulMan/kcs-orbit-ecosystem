import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.message import AnnouncementCreate, AnnouncementResponse
from app.integrations.orbit import sync_announcement
from app.services.analytics_service import analytics_service
from app.services.messaging_service import messaging_service


router = APIRouter(prefix="/messaging", tags=["Messaging"])


@router.post("/announcements", response_model=AnnouncementResponse)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.TEACHER)),
):
    started = time.perf_counter()
    item = messaging_service.create_announcement(
        db=db,
        author=current_user,
        title=payload.title,
        content=payload.content,
        priority=payload.priority,
        channel=payload.channel,
        scheduled_for=payload.scheduled_for,
    )
    latency = int((time.perf_counter() - started) * 1000)
    analytics_service.log_event(
        db,
        event_type="announcement_created",
        department=current_user.department,
        actor_id=current_user.id,
        latency_ms=latency,
    )
    sync_announcement(item)
    return item


@router.get("/announcements", response_model=list[AnnouncementResponse])
def list_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return messaging_service.list_announcements(db, current_user.role.value)
