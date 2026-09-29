import re
import unicodedata
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

MIN_PASSWORD_LENGTH = 14
FORBIDDEN_FRAGMENTS = {
    'password', 'motdepasse', 'passw0rd', 'qwerty', 'azerty', '123456',
    'admin', 'welcome', 'bienvenue', 'kinshasa', 'christian', 'school',
}


def _compact(value):
    normalized = unicodedata.normalize('NFKD', str(value or ''))
    return re.sub(r'[^a-zA-Z0-9]', '', normalized).lower()


def ecosystem_password_issues(password, user=None):
    issues = []
    if len(password) < MIN_PASSWORD_LENGTH:
        issues.append(f'Use at least {MIN_PASSWORD_LENGTH} characters.')
    if not re.search(r'[a-z]', password):
        issues.append('Add a lowercase letter.')
    if not re.search(r'[A-Z]', password):
        issues.append('Add an uppercase letter.')
    if not re.search(r'[0-9]', password):
        issues.append('Add a number.')
    if not re.search(r'[^A-Za-z0-9\s]', password):
        issues.append('Add a special character.')
    if re.search(r'\s', password):
        issues.append('Remove spaces and invisible separators.')
    if re.search(r'(.)\1\1', password, re.IGNORECASE):
        issues.append('Avoid three identical consecutive characters.')

    compact = _compact(password)
    if any(_compact(fragment) in compact for fragment in FORBIDDEN_FRAGMENTS):
        issues.append('Avoid common words, school names, keyboard patterns, and predictable sequences.')

    if user is not None:
        identity = [
            getattr(user, 'first_name', ''), getattr(user, 'middle_name', ''),
            getattr(user, 'last_name', ''), getattr(user, 'email', ''),
            getattr(user, 'access_code', ''), getattr(user, 'username', ''),
        ]
        fragments = {
            _compact(part)
            for value in identity
            for part in re.split(r'[@.\s_-]+', str(value or ''))
            if len(_compact(part)) >= 4
        }
        if any(fragment in compact for fragment in fragments):
            issues.append('Do not include your name, email, username, or access code.')
    return list(dict.fromkeys(issues))


def validate_ecosystem_password(password, user=None):
    issues = ecosystem_password_issues(password, user)
    try:
        validate_password(password, user=user)
    except ValidationError as error:
        issues.extend(error.messages)
    if issues:
        raise ValidationError(list(dict.fromkeys(issues)))
    return password
