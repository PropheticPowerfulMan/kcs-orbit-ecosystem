import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WorkflowType(str, enum.Enum):
    LEAVE_REQUEST = "leave_request"
    REPORT_SUBMISSION = "report_submission"
    APPROVAL_REQUEST = "approval_request"


class WorkflowStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class WorkflowItem(Base):
    __tablename__ = "workflow_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    type: Mapped[WorkflowType] = mapped_column(Enum(WorkflowType), nullable=False)
    status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), default=WorkflowStatus.PENDING)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    ai_suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
