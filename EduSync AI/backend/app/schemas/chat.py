from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    context: dict | None = None


class ChatResponse(BaseModel):
    intent: str
    confidence: float
    response: str
    actions: list[str]
