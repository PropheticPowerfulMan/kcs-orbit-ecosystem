from datetime import datetime

from pydantic import BaseModel

from app.models.message import MessagePriority
from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: int
    title: str
    content: str
    type: NotificationType
    priority: MessagePriority
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
