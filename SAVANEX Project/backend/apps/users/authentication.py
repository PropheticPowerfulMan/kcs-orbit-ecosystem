from django.db.models import Q, QuerySet

from .models import User


def _matching_users(identifier: str) -> tuple[QuerySet, QuerySet]:
    '''Return direct identities first, then employee contact aliases.'''
    normalized_identifier = (identifier or '').strip()
    direct_matches = User.objects.filter(is_active=True).filter(
        Q(username__iexact=normalized_identifier)
        | Q(email__iexact=normalized_identifier)
        | Q(access_code__iexact=normalized_identifier)
        | Q(kcs_card_id__iexact=normalized_identifier)
    ).distinct()
    alias_matches = User.objects.filter(is_active=True).filter(
        Q(teacher_profile__employee_id__iexact=normalized_identifier)
        | Q(teacher_profile__teacher_id__iexact=normalized_identifier)
        | Q(teacher_profile__work_email__iexact=normalized_identifier)
        | Q(teacher_profile__personal_email__iexact=normalized_identifier)
    ).exclude(pk__in=direct_matches.values('pk')).distinct()
    return direct_matches, alias_matches


def authenticate_user_identifier(identifier: str, password: str) -> User | None:
    '''Resolve shared identifiers without letting a contact alias shadow its owner.'''
    if not (identifier or '').strip() or not password:
        return None

    direct_matches, alias_matches = _matching_users(identifier)
    for candidates in (direct_matches, alias_matches):
        for user in candidates:
            if user.check_password(password):
                return user
    return None
