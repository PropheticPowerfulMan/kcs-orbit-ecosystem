from app.schemas.chat import ChatResponse
from app.services.ai.external_ai_partner import external_ai_partner
from app.services.ai.nlp_engine import NLPEngine


class ChatbotService:
    def __init__(self):
        self.nlp = NLPEngine()

    def process_message(self, message: str, context: dict | None = None) -> ChatResponse:
        intent, confidence = self.nlp.detect_intent(message)
        response_text, actions = self.nlp.generate_context_response(intent, context, message)
        language = self.nlp._detect_language(self.nlp._normalize(message))
        polished = external_ai_partner.polish_response(message, response_text, language)
        if polished:
            response_text = polished
            actions = [*actions, "external_ai_partner_polished"]
        return ChatResponse(
            intent=intent,
            confidence=confidence,
            response=response_text,
            actions=actions,
        )


chatbot_service = ChatbotService()
