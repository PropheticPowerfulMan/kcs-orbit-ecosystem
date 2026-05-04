import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MessagePriority(str, enum.Enum):
    URGENT = "urgent"
    NORMAL = "normal"
    INFORMATIONAL = "informational"


class MessageStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    SENT = "sent"
    DRAFT = "draft"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[MessagePriority] = mapped_column(Enum(MessagePriority), default=MessagePriority.NORMAL)
    channel: Mapped[str] = mapped_column(String(50), default="all")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[MessageStatus] = mapped_column(Enum(MessageStatus), default=MessageStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
