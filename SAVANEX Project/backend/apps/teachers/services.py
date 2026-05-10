from django.db import transaction

from apps.integration.orbit import sync_teacher

from .models import Teacher


def apply_teacher_status(teacher, *, is_active: bool) -> None:
    teacher.is_active = is_active
    teacher.employment_status = Teacher.STATUS_ACTIVE if is_active else Teacher.STATUS_INACTIVE
    teacher.user.is_active = is_active


def deactivate_teacher(teacher) -> None:
    with transaction.atomic():
        apply_teacher_status(teacher, is_active=False)
        teacher.user.save(update_fields=['is_active'])
        teacher.save(update_fields=['is_active', 'employment_status'])
        transaction.on_commit(lambda: sync_teacher(teacher))