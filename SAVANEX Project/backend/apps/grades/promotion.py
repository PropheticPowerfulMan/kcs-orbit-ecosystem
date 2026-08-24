from django.db import transaction

from apps.classes.utils import STANDARD_CLASS_LEVELS, get_or_create_standard_class
from apps.communication.models import Notification
from apps.communication.services import deliver_parent_communication
from apps.integration.orbit import sync_student


PASSING_GRADE = 70.0
FINAL_TERM = 'T3'


def _class_suffix(student_class):
    level_name = student_class.level.name
    class_name = student_class.name.strip()
    if class_name.lower().startswith(level_name.lower()):
        return class_name[len(level_name):].strip()
    return ''


def promote_student_from_final_report(report):
    """Promote once after the final report and notify the linked parent."""
    if report.term != FINAL_TERM or float(report.overall_average or 0) < PASSING_GRADE:
        return None

    existing_data = report.data if isinstance(report.data, dict) else {}
    if existing_data.get('promotion', {}).get('applied'):
        return existing_data['promotion']

    with transaction.atomic():
        student = type(report.student).objects.select_for_update().select_related(
            'user', 'parent', 'current_class__level'
        ).get(pk=report.student_id)
        current_class = student.current_class
        if not current_class or current_class.level.name not in STANDARD_CLASS_LEVELS:
            return None

        current_index = STANDARD_CLASS_LEVELS.index(current_class.level.name)
        if current_index >= len(STANDARD_CLASS_LEVELS) - 1:
            return None

        next_level = STANDARD_CLASS_LEVELS[current_index + 1]
        next_class = get_or_create_standard_class(next_level, _class_suffix(current_class))
        student.current_class = next_class
        student.save(update_fields=['current_class'])

        promotion = {
            'applied': True,
            'passingGrade': PASSING_GRADE,
            'finalAverage': float(report.overall_average),
            'fromClass': current_class.name,
            'toClass': next_class.name,
        }
        report.data = {**existing_data, 'promotion': promotion}
        report.save(update_fields=['data'])

    sync_student(student)
    if student.parent_id:
        subject = f'Promotion scolaire de {student.full_name or student.student_id}'
        body = (
            f'Bonjour, SAVANEX vous informe que {student.full_name or student.student_id} '
            f'a obtenu une moyenne finale de {float(report.overall_average):.2f}%. '
            f'Le seuil de réussite est de {PASSING_GRADE:.0f}%. '
            f'L élève passe automatiquement de {current_class.name} à {next_class.name}. '
            'Cette évolution a été synchronisée dans l écosystème scolaire.'
        )
        deliver_parent_communication(
            student.parent,
            subject,
            body,
            notif_type=Notification.TYPE_GRADE,
            link='/communication',
        )

    return promotion