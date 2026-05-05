from datetime import datetime

from sqlalchemy.orm import Session

from app.models.message import Announcement, MessagePriority, MessageStatus
from app.models.user import User


class MessagingService:
    def create_announcement(
        self,
        db: Session,
        author: User,
        title: str,
        content: str,
        priority: MessagePriority,
        channel: str,
        scheduled_for: datetime | None,
    ) -> Announcement:
        status = MessageStatus.SCHEDULED if scheduled_for else MessageStatus.SENT
        item = Announcement(
            title=title,
            content=content,
            priority=priority,
            channel=channel,
            created_by=author.id,
            scheduled_for=scheduled_for,
            status=status,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def list_announcements(self, db: Session, role: str, limit: int = 50) -> list[Announcement]:
        query = db.query(Announcement)

        if role != "admin":
            allowed_channels = {"all"}
            if role in {"teacher", "staff"}:
                allowed_channels.update({"staff", "teachers"})

            query = query.filter(Announcement.channel.in_(allowed_channels))

        return query.order_by(Announcement.created_at.desc()).limit(limit).all()


messaging_service = MessagingService()
