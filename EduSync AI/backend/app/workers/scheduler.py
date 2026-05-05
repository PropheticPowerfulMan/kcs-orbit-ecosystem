from datetime import datetime
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.db.session import SessionLocal
from app.integrations.orbit import flush_outbox
from app.models.message import Announcement, MessageStatus


scheduler = BackgroundScheduler(timezone="UTC")
logger = logging.getLogger(__name__)


def dispatch_scheduled_announcements() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        due = (
            db.query(Announcement)
            .filter(
                Announcement.status == MessageStatus.SCHEDULED,
                Announcement.scheduled_for <= now,
            )
            .all()
        )
        for item in due:
            item.status = MessageStatus.SENT
        if due:
            db.commit()
    finally:
        db.close()


def flush_orbit_outbox() -> None:
    flushed = flush_outbox()
    if flushed:
        logger.info("Orbit outbox worker flushed %s pending event(s)", flushed)


scheduler.add_job(
    dispatch_scheduled_announcements,
    trigger="interval",
    minutes=1,
    id="dispatch-announcements",
    replace_existing=True,
)

scheduler.add_job(
    flush_orbit_outbox,
    trigger="interval",
    seconds=max(5, settings.orbit_outbox_retry_interval_seconds),
    id="flush-orbit-outbox",
    replace_existing=True,
)
