from sqlalchemy.orm import Session

from app.models.workflow import WorkflowItem, WorkflowStatus, WorkflowType


class WorkflowService:
    def suggest_decision(self, workflow_type: WorkflowType, payload: str) -> str:
        text = payload.lower()
        if workflow_type == WorkflowType.LEAVE_REQUEST:
            if any(token in text for token in ("medical", "sick", "urgent", "emergency")):
                return (
                    "AI suggestion: prioritize this leave request, verify policy requirements, "
                    "confirm coverage, and notify the approver immediately."
                )
            if any(token in text for token in ("exam", "supervision", "recovery")):
                return (
                    "AI suggestion: check exam supervision records, confirm substitute coverage, "
                    "then route to administration for a quick decision."
                )
            return (
                "AI suggestion: verify leave balance, requested dates, handover details, "
                "and department coverage before approval."
            )
        if workflow_type == WorkflowType.REPORT_SUBMISSION:
            if any(token in text for token in ("missing", "incomplete", "draft")):
                return "AI suggestion: request completion before approval; required sections appear incomplete."
            return (
                "AI suggestion: review summary, metrics, risks, and evidence; approve if all mandatory "
                "sections are complete."
            )
        if any(token in text for token in ("budget", "purchase", "payment", "expense")):
            return (
                "AI suggestion: route through the finance approval path, verify budget owner, "
                "and request supporting documents."
            )
        return (
            "AI suggestion: review business context, urgency, owner, and expected outcome, "
            "then proceed through the standard approval matrix."
        )

    def create(self, db: Session, requester_id: int, workflow_type: WorkflowType, payload: str) -> WorkflowItem:
        suggestion = self.suggest_decision(workflow_type, payload)
        item = WorkflowItem(
            requester_id=requester_id,
            type=workflow_type,
            payload=payload,
            ai_suggestion=suggestion,
            status=WorkflowStatus.PENDING,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def decide(
        self,
        db: Session,
        item_id: int,
        approver_id: int,
        status: WorkflowStatus,
    ) -> WorkflowItem | None:
        item = db.query(WorkflowItem).filter(WorkflowItem.id == item_id).first()
        if not item:
            return None
        item.approver_id = approver_id
        item.status = status
        db.commit()
        db.refresh(item)
        return item

    def list_items(self, db: Session, requester_id: int | None = None) -> list[WorkflowItem]:
        query = db.query(WorkflowItem)
        if requester_id:
            query = query.filter(WorkflowItem.requester_id == requester_id)
        return query.order_by(WorkflowItem.created_at.desc()).all()


workflow_service = WorkflowService()
