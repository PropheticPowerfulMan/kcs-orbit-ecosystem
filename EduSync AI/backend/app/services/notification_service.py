from sqlalchemy.orm import Session

from app.models.message import MessagePriority
from app.models.notification import Notification, NotificationType


class NotificationService:
    def push(
        self,
        db: Session,
        user_id: int,
        title: str,
        content: str,
        notification_type: NotificationType = NotificationType.INFO,
        priority: MessagePriority = MessagePriority.NORMAL,
    ) -> Notification:
        note = Notification(
            user_id=user_id,
            title=title,
            content=content,
            type=notification_type,
            priority=priority,
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note

    def list_for_user(self, db: Session, user_id: int) -> list[Notification]:
        return (
            db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .all()
        )

    def mark_read(self, db: Session, notification_id: int, user_id: int) -> Notification | None:
        note = (
            db.query(Notification)
            .filter(Notification.id == notification_id, Notification.user_id == user_id)
            .first()
        )
        if note:
            note.is_read = True
            db.commit()
            db.refresh(note)
        return note


notification_service = NotificationService()
