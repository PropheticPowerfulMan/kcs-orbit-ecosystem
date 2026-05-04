from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.workflow import WorkflowCreate, WorkflowDecision, WorkflowResponse
from app.services.analytics_service import analytics_service
from app.services.notification_service import notification_service
from app.services.workflow_service import workflow_service


router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.post("", response_model=WorkflowResponse)
def create_workflow(
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = workflow_service.create(db, current_user.id, payload.type, payload.payload)
    analytics_service.log_event(
        db,
        event_type="workflow_created",
        department=current_user.department,
        actor_id=current_user.id,
    )
    return item


@router.patch("/{item_id}/decision", response_model=WorkflowResponse)
def decide_workflow(
    item_id: int,
    payload: WorkflowDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    item = workflow_service.decide(db, item_id, current_user.id, payload.status)
    if not item:
        raise HTTPException(status_code=404, detail="Workflow item not found")

    notification_service.push(
        db,
        user_id=item.requester_id,
        title="Workflow Updated",
        content=f"Your request #{item.id} is now {item.status.value}",
    )
    analytics_service.log_event(
        db,
        event_type="workflow_decision",
        department=current_user.department,
        actor_id=current_user.id,
    )
    return item


@router.get("", response_model=list[WorkflowResponse])
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        return workflow_service.list_items(db)
    return workflow_service.list_items(db, requester_id=current_user.id)
