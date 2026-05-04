from datetime import datetime

from pydantic import BaseModel

from app.models.message import MessagePriority, MessageStatus


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: MessagePriority = MessagePriority.NORMAL
    channel: str = "all"
    scheduled_for: datetime | None = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    priority: MessagePriority
    channel: str
    status: MessageStatus

    class Config:
        from_attributes = True
