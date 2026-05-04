import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.analytics_service import analytics_service
from app.services.chatbot_service import chatbot_service


router = APIRouter(prefix="/chat", tags=["AI Chatbot"])


@router.post("/query", response_model=ChatResponse)
def query_bot(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    started = time.perf_counter()
    context = payload.context or {}
    context.setdefault("department", current_user.department)

    response = chatbot_service.process_message(payload.message, context)

    latency = int((time.perf_counter() - started) * 1000)
    analytics_service.log_event(
        db,
        event_type="chat_query",
        department=current_user.department,
        actor_id=current_user.id,
        latency_ms=latency,
    )
    return response
