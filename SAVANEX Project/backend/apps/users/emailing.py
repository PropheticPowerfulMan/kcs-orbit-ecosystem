import re
import unicodedata

from django.conf import settings

from .models import User


def _email_token(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", ascii_value.lower())


def generate_school_email(*, first_name: str, middle_name: str = "", last_name: str) -> str:
    """Return a short, readable and currently unused school email address."""
    domain = settings.SCHOOL_EMAIL_DOMAIN.strip().lower().lstrip("@")
    first = _email_token(first_name) or "user"
    middle = _email_token(middle_name)
    last = _email_token(last_name) or "kcs"

    bases = [f"{first}.{last}"]
    if middle:
        bases.append(f"{first}.{middle[0]}.{last}")
        bases.append(f"{first}.{middle}.{last}")

    for base in bases:
        candidate = f"{base}@{domain}"
        if not User.objects.filter(email__iexact=candidate).exists():
            return candidate

    sequence = 2
    while True:
        candidate = f"{bases[0]}{sequence}@{domain}"
        if not User.objects.filter(email__iexact=candidate).exists():
            return candidate
        sequence += 1