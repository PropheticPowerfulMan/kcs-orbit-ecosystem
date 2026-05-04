from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.session import SessionLocal
from app.models.message import Announcement, MessageStatus


scheduler = BackgroundScheduler(timezone="UTC")


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


scheduler.add_job(
    dispatch_scheduled_announcements,
    trigger="interval",
    minutes=1,
    id="dispatch-announcements",
    replace_existing=True,
)
