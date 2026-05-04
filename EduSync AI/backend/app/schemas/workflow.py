from pydantic import BaseModel

from app.models.workflow import WorkflowStatus, WorkflowType


class WorkflowCreate(BaseModel):
    type: WorkflowType
    payload: str


class WorkflowDecision(BaseModel):
    status: WorkflowStatus


class WorkflowResponse(BaseModel):
    id: int
    requester_id: int
    approver_id: int | None
    type: WorkflowType
    status: WorkflowStatus
    payload: str
    ai_suggestion: str | None

    class Config:
        from_attributes = True
