import json
import urllib.error
import urllib.request

from app.core.config import settings


class ExternalAIPartner:
    """Optional OpenAI-compatible reasoning layer for wording, never for facts.

    The deterministic NLPEngine remains the source of truth for intent, directory
    rows, metrics and safety limits. This partner may only rewrite the final
    response using the verified answer it receives.
    """

    def is_configured(self) -> bool:
        return bool(
            settings.external_ai_enabled
            and settings.external_ai_base_url
            and settings.external_ai_api_key
            and settings.external_ai_model
        )

    def polish_response(self, message: str, verified_response: str, language: str) -> str | None:
        if not self.is_configured():
            return None

        system_prompt = (
            "You are EduSync AI, the official operational spokesperson for a school ecosystem. "
            "Rewrite the verified response so it is intelligent, direct, and helpful. "
            "Never add names, counts, payments, grades, classes, or facts not present in the verified response. "
            "If data is missing, preserve the missing-data warning. "
            "Return only the final answer, no markdown fence."
        )
        payload = {
            "model": settings.external_ai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "language": language,
                            "user_message": message,
                            "verified_response": verified_response,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0.2,
        }
        url = settings.external_ai_base_url.rstrip("/") + "/chat/completions"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.external_ai_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=settings.external_ai_timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            return None

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content")
        )
        return content.strip() if isinstance(content, str) and content.strip() else None


external_ai_partner = ExternalAIPartner()
