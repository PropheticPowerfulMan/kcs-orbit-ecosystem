from app.schemas.chat import ChatResponse
from app.services.ai.nlp_engine import NLPEngine


class ChatbotService:
    def __init__(self):
        self.nlp = NLPEngine()

    def process_message(self, message: str, context: dict | None = None) -> ChatResponse:
        intent, confidence = self.nlp.detect_intent(message)
        response_text, actions = self.nlp.generate_context_response(intent, context, message)
        return ChatResponse(
            intent=intent,
            confidence=confidence,
            response=response_text,
            actions=actions,
        )


chatbot_service = ChatbotService()
