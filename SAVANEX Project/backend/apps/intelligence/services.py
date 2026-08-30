import csv
from io import BytesIO, StringIO

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.attendance.models import Attendance
from apps.classes.models import Class
from apps.communication.models import Notification
from apps.communication.services import (
    DeliveryResult,
    _send_parent_email,
    _send_parent_sms,
    _short_sms,
)
from apps.grades.models import Grade, ReportCard
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.users.models import User

from .models import EvolutionAlertDelivery, EvolutionEvent


def _student_label(student):
    return student.full_name or student.student_id or str(student)


def _classical_equivalent(excellence_percentage):
    if excellence_percentage is None:
        return None
    if excellence_percentage <= 70:
        return round(excellence_percentage * (50 / 70), 2)
    return round(50 + ((excellence_percentage - 70) * (50 / 30)), 2)


SCIENCE_KEYWORDS = [
    'science',
    'biology',
    'chimie',
    'chemistry',
    'physique',
    'physics',
    'math',
    'algebra',
    'calculus',
    'laboratoire',
    'lab',
    'technology',
    'ict',
]


def _subject_domain(subject_name):
    normalized = (subject_name or '').lower()
    if any(keyword in normalized for keyword in SCIENCE_KEYWORDS):
        return 'scientific'
    return 'non_scientific'


def _average(values):
    safe_values = [float(value) for value in values if value is not None]
    return round(sum(safe_values) / len(safe_values), 2) if safe_values else None


def _discipline_level(absences, lates, negative_events):
    score = (absences or 0) * 12 + (lates or 0) * 5 + negative_events * 18
    if score >= 55:
        return 'critical'
    if score >= 28:
        return 'warning'
    if score > 0:
        return 'watch'
    return 'clear'


def _prediction_from_metrics(metrics):
    risk_score = 0
    if metrics.get('average_normalized') is not None:
        risk_score += max(0, 70 - float(metrics['average_normalized'])) * 1.2
    if metrics.get('attendance_rate') is not None:
        risk_score += max(0, 90 - float(metrics['attendance_rate'])) * 1.1
    risk_score += (metrics.get('absences') or 0) * 7
    risk_score += (metrics.get('lates') or 0) * 3
    risk_score += len(metrics.get('discipline_flags') or []) * 12
    risk_score = round(min(100, max(0, risk_score)), 2)
    if risk_score >= 72:
        level = 'critical'
    elif risk_score >= 48:
        level = 'warning'
    elif risk_score <= 18:
        level = 'strong'
    else:
        level = 'stable'
    return {'risk_score': risk_score, 'level': level}


def _student_recommendations(metrics):
    recommendations = []
    if metrics.get('average_normalized') is not None and metrics['average_normalized'] < 70:
        recommendations.append('Ouvrir un plan de soutien académique hebdomadaire avec objectifs mesurables.')
    if metrics.get('attendance_rate') is not None and metrics['attendance_rate'] < 90:
        recommendations.append('Déclencher un suivi présence avec le parent et contrôle quotidien.')
    if metrics.get('discipline_level') in ['warning', 'critical']:
        recommendations.append('Planifier une rencontre restorative discipline avec trace ecrite et date de suivi.')
    preference = metrics.get('learning_preference')
    if preference == 'scientific':
        recommendations.append('Orienter vers laboratoire, STEM, projets pratiques et mentorat scientifique.')
    elif preference == 'non_scientific':
        recommendations.append('Orienter vers langues, humanites, arts, leadership et communication.')
    else:
        recommendations.append('Garder une exploration mixte science/non-science avant toute orientation definitive.')
    return recommendations


def _entity_identity(instance):
    if isinstance(instance, Student):
        return instance, 'student', str(instance.pk), _student_label(instance)
    if isinstance(instance, Grade):
        return instance.student, 'grade', str(instance.pk), _student_label(instance.student)
    if isinstance(instance, Attendance):
        return instance.student, 'attendance', str(instance.pk), _student_label(instance.student)
    if isinstance(instance, ReportCard):
        return instance.student, 'report_card', str(instance.pk), _student_label(instance.student)
    return None, instance.__class__.__name__.lower(), str(getattr(instance, 'pk', '') or ''), str(instance)


def analyze_student_evolution(student, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    current_start = reference_date - timezone.timedelta(days=30)
    previous_start = reference_date - timezone.timedelta(days=60)

    def attendance_window(start, end):
        qs = Attendance.objects.filter(student=student, date__gte=start, date__lte=end)
        totals = qs.aggregate(
            total=Count('id'),
            engaged=Count('id', filter=Q(status__in=['present', 'late', 'excused'])),
            absent=Count('id', filter=Q(status='absent')),
            late=Count('id', filter=Q(status='late')),
        )
        total = totals['total'] or 0
        return {
            **totals,
            'rate': round((totals['engaged'] / total) * 100, 2) if total else None,
        }

    def grade_average(qs):
        values = [grade.excellence_percentage for grade in qs]
        return round(sum(values) / len(values), 2) if values else None

    current_attendance = attendance_window(current_start, reference_date)
    previous_attendance = attendance_window(previous_start, current_start - timezone.timedelta(days=1))
    current_grade_qs = Grade.objects.filter(student=student, date__gte=current_start, date__lte=reference_date).select_related('class_subject__subject')
    previous_grade_qs = Grade.objects.filter(student=student, date__gte=previous_start, date__lt=current_start).select_related('class_subject__subject')
    current_average = grade_average(current_grade_qs)
    previous_average = grade_average(previous_grade_qs)
    science_scores = []
    non_science_scores = []
    subject_breakdown = {}
    for grade in current_grade_qs:
        subject_name = getattr(grade.class_subject.subject, 'name', '')
        domain = _subject_domain(subject_name)
        score = grade.excellence_percentage
        subject_breakdown.setdefault(subject_name or 'Unknown', {'domain': domain, 'scores': []})
        subject_breakdown[subject_name or 'Unknown']['scores'].append(score)
        if domain == 'scientific':
            science_scores.append(score)
        else:
            non_science_scores.append(score)
    science_average = _average(science_scores)
    non_science_average = _average(non_science_scores)
    if science_average is not None and non_science_average is not None:
        if science_average >= non_science_average + 4:
            learning_preference = 'scientific'
        elif non_science_average >= science_average + 4:
            learning_preference = 'non_scientific'
        else:
            learning_preference = 'balanced'
    elif science_average is not None:
        learning_preference = 'scientific'
    elif non_science_average is not None:
        learning_preference = 'non_scientific'
    else:
        learning_preference = 'unknown'

    grade_delta = None
    if current_average is not None and previous_average is not None:
        grade_delta = round(current_average - previous_average, 2)

    attendance_delta = None
    if current_attendance['rate'] is not None and previous_attendance['rate'] is not None:
        attendance_delta = round(current_attendance['rate'] - previous_attendance['rate'], 2)

    flags = []
    severity = EvolutionEvent.SEVERITY_INFO
    if current_attendance['rate'] is not None and current_attendance['rate'] < 65:
        flags.append('critical_attendance')
        severity = EvolutionEvent.SEVERITY_CRITICAL
    elif current_attendance['rate'] is not None and current_attendance['rate'] < 70:
        flags.append('low_attendance')
        severity = EvolutionEvent.SEVERITY_WARNING

    if current_average is not None and current_average < 60:
        flags.append('critical_performance')
        severity = EvolutionEvent.SEVERITY_CRITICAL
    elif current_average is not None and current_average < 70:
        flags.append('low_performance')
        if severity != EvolutionEvent.SEVERITY_CRITICAL:
            severity = EvolutionEvent.SEVERITY_WARNING

    if grade_delta is not None and grade_delta <= -10:
        flags.append('performance_drop')
        if severity != EvolutionEvent.SEVERITY_CRITICAL:
            severity = EvolutionEvent.SEVERITY_WARNING
    elif grade_delta is not None and grade_delta >= 10 and not flags:
        flags.append('strong_progress')
        severity = EvolutionEvent.SEVERITY_SUCCESS

    negative_events = EvolutionEvent.objects.filter(
        subject_student=student,
        created_at__date__gte=current_start,
        severity__in=[EvolutionEvent.SEVERITY_WARNING, EvolutionEvent.SEVERITY_CRITICAL],
    ).count()
    discipline_level = _discipline_level(current_attendance['absent'] or 0, current_attendance['late'] or 0, negative_events)
    discipline_flags = []
    if current_attendance['absent']:
        discipline_flags.append('absence_pattern')
    if current_attendance['late']:
        discipline_flags.append('late_pattern')
    if negative_events:
        discipline_flags.append('negative_evolution_events')

    metrics = {
        'period_days': 30,
        'attendance_rate': current_attendance['rate'],
        'previous_attendance_rate': previous_attendance['rate'],
        'attendance_delta': attendance_delta,
        'absences': current_attendance['absent'] or 0,
        'lates': current_attendance['late'] or 0,
        'average_normalized': current_average,
        'average_classical_equivalent': _classical_equivalent(current_average),
        'previous_average_normalized': previous_average,
        'previous_classical_equivalent': _classical_equivalent(previous_average),
        'grade_delta': grade_delta,
        'flags': flags,
        'science_average': science_average,
        'non_science_average': non_science_average,
        'learning_preference': learning_preference,
        'subject_breakdown': {
            subject: {
                'domain': values['domain'],
                'average': _average(values['scores']),
                'count': len(values['scores']),
            }
            for subject, values in subject_breakdown.items()
        },
        'discipline_level': discipline_level,
        'discipline_flags': discipline_flags,
    }
    prediction = _prediction_from_metrics(metrics)
    metrics.update({
        'risk_score': prediction['risk_score'],
        'prediction_level': prediction['level'],
        'recommendations': _student_recommendations(metrics),
        'alert_channels': {
            'in_app': prediction['risk_score'] >= 18 or severity in [EvolutionEvent.SEVERITY_SUCCESS, EvolutionEvent.SEVERITY_WARNING, EvolutionEvent.SEVERITY_CRITICAL],
            'email': prediction['risk_score'] >= 48 or severity in [EvolutionEvent.SEVERITY_WARNING, EvolutionEvent.SEVERITY_CRITICAL],
            'sms': prediction['risk_score'] >= 72 or discipline_level in ['warning', 'critical'],
        },
    })
    return severity, metrics, current_start, reference_date


def _build_summary(student, trigger_label, metrics):
    lines = [f'Suivi intelligent de {_student_label(student)}.', f'Dernier signal: {trigger_label}.']
    if metrics.get('average_normalized') is not None:
        lines.append(f"Moyenne excellence 30 jours: {metrics['average_normalized']}%.")
    if metrics.get('grade_delta') is not None:
        lines.append(f"Evolution des notes: {metrics['grade_delta']:+.2f} point(s).")
    if metrics.get('attendance_rate') is not None:
        lines.append(f"Présence 30 jours: {metrics['attendance_rate']}%.")
    if metrics.get('absences') or metrics.get('lates'):
        lines.append(f"Absences: {metrics.get('absences', 0)}; retards: {metrics.get('lates', 0)}.")
    if metrics.get('learning_preference') and metrics.get('learning_preference') != 'unknown':
        lines.append(f"Preference detectee: {metrics['learning_preference']}.")
    if metrics.get('discipline_level'):
        lines.append(f"Discipline: {metrics['discipline_level']}.")
    if metrics.get('risk_score') is not None:
        lines.append(f"Prediction risque: {metrics['risk_score']}% ({metrics.get('prediction_level')}).")
    if metrics.get('flags'):
        lines.append("Attention recommandée par l'écosystème.")
    if metrics.get('recommendations'):
        lines.append('Recommandation: ' + metrics['recommendations'][0])
    return '\n'.join(lines)


def _delivery_to_model(event, recipient, result):
    EvolutionAlertDelivery.objects.create(
        event=event,
        recipient=recipient,
        channel=result.channel,
        status=result.status,
        detail=result.detail,
    )


def _send_user_email(user, subject, body):
    return _send_parent_email(user, subject, body)


def _send_user_sms(user, body):
    return _send_parent_sms(user, body)


def _notify_user(event, user, subject, body):
    if not user or not user.is_active:
        return 0

    Notification.objects.create(
        user=user,
        title=subject[:200],
        body=body,
        notif_type=Notification.TYPE_WARNING if event.severity in ['warning', 'critical'] else Notification.TYPE_ANNOUNCEMENT,
        link='/intelligence',
    )
    _delivery_to_model(event, user, DeliveryResult('in_app', 'sent', 'Notification SAVANEX creee.'))
    count = 1

    for result in [_send_user_email(user, subject, body), _send_user_sms(user, _short_sms(subject, body))]:
        _delivery_to_model(event, user, result)
        if result.status in ['sent', 'simulated']:
            count += 1
    return count


def notify_event_stakeholders(event):
    if event.severity not in [EvolutionEvent.SEVERITY_WARNING, EvolutionEvent.SEVERITY_CRITICAL, EvolutionEvent.SEVERITY_SUCCESS]:
        return 0

    student = event.subject_student
    recipients = []
    recipients.extend(User.objects.filter(role=User.ROLE_ADMIN, is_active=True))
    if student:
        recipients.append(student.user)
        if student.parent:
            recipients.append(student.parent)

    unique_recipients = []
    seen = set()
    for recipient in recipients:
        if recipient and recipient.pk not in seen:
            unique_recipients.append(recipient)
            seen.add(recipient.pk)

    subject = f'Ecosysteme SAVANEX - {event.title}'
    sent_count = 0
    for recipient in unique_recipients:
        sent_count += _notify_user(event, recipient, subject, event.summary)

    event.alerts_sent = sent_count
    event.save(update_fields=['alerts_sent'])
    return sent_count


def observe_evolution(instance, event_type, trigger_label, actor=None, force_alert=False, snapshot=None):
    student, entity_type, entity_id, entity_label = _entity_identity(instance)
    severity = EvolutionEvent.SEVERITY_INFO
    metrics = {}
    period_start = None
    period_end = None

    if student:
        severity, metrics, period_start, period_end = analyze_student_evolution(student)

    if force_alert and severity == EvolutionEvent.SEVERITY_INFO:
        severity = EvolutionEvent.SEVERITY_WARNING

    summary = _build_summary(student, trigger_label, metrics) if student else trigger_label
    content_type = ContentType.objects.get_for_model(instance.__class__) if getattr(instance, 'pk', None) else None
    event = EvolutionEvent.objects.create(
        content_type=content_type,
        object_id=getattr(instance, 'pk', None),
        subject_student=student,
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        event_type=event_type,
        severity=severity,
        title=trigger_label[:220],
        summary=summary,
        metrics=metrics,
        snapshot=snapshot or {},
        period_start=period_start,
        period_end=period_end,
    )
    notify_event_stakeholders(event)
    return event


def observe_grade(grade, actor=None):
    subject_name = getattr(grade.class_subject.subject, 'name', 'matiere')
    return observe_evolution(
        grade,
        EvolutionEvent.EVENT_GRADE,
        f'Note publiée en {subject_name}: {grade.excellence_percentage}%',
        actor=actor or grade.entered_by,
        force_alert=float(grade.excellence_percentage) < 70,
        snapshot={
            'score': float(grade.score),
            'max_score': float(grade.max_score),
            'excellence_percentage': grade.excellence_percentage,
            'classical_equivalent_percentage': grade.classical_equivalent_percentage,
            'percentage': grade.percentage,
        },
    )


def observe_attendance(attendance, actor=None):
    return observe_evolution(
        attendance,
        EvolutionEvent.EVENT_ATTENDANCE,
        f'Présence du {attendance.date}: {attendance.get_status_display()}',
        actor=actor or attendance.recorded_by,
        force_alert=attendance.status in [Attendance.STATUS_ABSENT, Attendance.STATUS_LATE],
        snapshot={'date': str(attendance.date), 'status': attendance.status, 'notes': attendance.notes},
    )


def observe_report_card(report):
    return observe_evolution(
        report,
        EvolutionEvent.EVENT_REPORT_CARD,
        f'Bulletin {report.term} genere: moyenne excellence {report.overall_average}%',
        force_alert=True,
        snapshot={'term': report.term, 'overall_average_percent': float(report.overall_average or 0), 'rank': report.rank},
    )


def _payload_value(payload, *keys, default=None):
    for key in keys:
        if key in payload and payload[key] not in [None, '']:
            return payload[key]
    return default


def _find_student_from_external_payload(payload):
    identifiers = [
        _payload_value(payload, 'studentExternalId', 'student_external_id'),
        _payload_value(payload, 'studentNumber', 'student_number'),
        _payload_value(payload, 'studentId', 'student_id'),
        _payload_value(payload, 'externalId', 'external_id'),
    ]
    identifiers = [str(value).strip() for value in identifiers if value]
    for identifier in identifiers:
        student = Student.objects.filter(student_id=identifier).select_related('user', 'parent').first()
        if student:
            return student
    return None


def _nexus_event_type(kind):
    kind = (kind or '').lower()
    if kind in ['grade', 'score', 'assessment', 'exam', 'quiz']:
        return EvolutionEvent.EVENT_NEXUS_GRADE
    if kind in ['pedagogy', 'pedagogic', 'skill', 'competency', 'competence', 'assignment', 'homework', 'project']:
        return EvolutionEvent.EVENT_NEXUS_PEDAGOGY
    if kind in ['ai', 'recommendation', 'risk', 'tutor', 'intervention']:
        return EvolutionEvent.EVENT_NEXUS_AI
    return EvolutionEvent.EVENT_NEXUS_ACADEMIC


def _nexus_severity(payload):
    risk = str(_payload_value(payload, 'riskLevel', 'risk_level', default='')).lower()
    if risk in ['critical', 'high', 'urgent']:
        return EvolutionEvent.SEVERITY_CRITICAL
    if risk in ['medium', 'warning', 'moderate']:
        return EvolutionEvent.SEVERITY_WARNING
    if risk in ['positive', 'success', 'improving']:
        return EvolutionEvent.SEVERITY_SUCCESS

    score = _payload_value(payload, 'score')
    max_score = _payload_value(payload, 'maxScore', 'max_score')
    percentage = _payload_value(payload, 'percentage')
    try:
        if percentage is None and score is not None and max_score:
            percentage = float(score) / float(max_score) * 100
        if percentage is not None:
            percentage = float(percentage)
            if percentage < 60:
                return EvolutionEvent.SEVERITY_CRITICAL
            if percentage < 70:
                return EvolutionEvent.SEVERITY_WARNING
            if percentage >= 90:
                return EvolutionEvent.SEVERITY_SUCCESS
    except (TypeError, ValueError, ZeroDivisionError):
        pass

    return EvolutionEvent.SEVERITY_INFO


def ingest_nexus_academic_event(envelope):
    payload = envelope.get('payload') or envelope
    student = _find_student_from_external_payload(payload)
    kind = _payload_value(payload, 'eventType', 'type', 'kind', default=envelope.get('eventType') or 'academic')
    subject = _payload_value(payload, 'subject', 'courseName', 'course', default='Academique')
    title = _payload_value(payload, 'title', 'assignmentTitle', 'competency', default=None)
    student_label = _student_label(student) if student else _payload_value(payload, 'studentName', 'studentFullName', default='Entité académique Nexus')

    event_type = _nexus_event_type(kind)
    severity = _nexus_severity(payload)
    external_id = str(envelope.get('externalId') or _payload_value(payload, 'id', 'gradeId', 'assignmentId', default='')).strip()
    score = _payload_value(payload, 'score')
    max_score = _payload_value(payload, 'maxScore', 'max_score')
    percentage = _payload_value(payload, 'percentage')
    if percentage is None and score is not None and max_score:
        try:
            percentage = round(float(score) / float(max_score) * 100, 2)
        except (TypeError, ValueError, ZeroDivisionError):
            percentage = None

    metrics = {
        'source_app': envelope.get('sourceApp') or 'KCS_NEXUS',
        'kind': kind,
        'subject': subject,
        'domain': _subject_domain(subject),
        'score': score,
        'max_score': max_score,
        'percentage': percentage,
        'term': _payload_value(payload, 'term', 'period'),
        'discipline_level': _payload_value(payload, 'disciplineLevel', 'discipline_level'),
        'learning_preference': _payload_value(payload, 'learningPreference', 'learning_preference'),
        'recommendation': _payload_value(payload, 'recommendation', 'description', 'feedback', 'comment'),
        'risk_level': _payload_value(payload, 'riskLevel', 'risk_level'),
        'teacher': _payload_value(payload, 'teacherName', 'teacher'),
        'flags': [flag for flag in [_payload_value(payload, 'riskLevel', 'risk_level')] if flag],
    }
    summary_parts = [
        f'Signal Nexus AI pour {student_label}.',
        f'Domaine: {subject}.',
    ]
    if title:
        summary_parts.append(f'Objet: {title}.')
    if score is not None and max_score is not None:
        summary_parts.append(f'Note: {score}/{max_score}.')
    if percentage is not None:
        summary_parts.append(f'Pourcentage: {percentage}%.')
    recommendation = _payload_value(payload, 'recommendation', 'description', 'feedback', 'comment')
    if recommendation:
        summary_parts.append(str(recommendation))

    event = EvolutionEvent.objects.create(
        subject_student=student,
        entity_type='nexus_academic',
        entity_id=external_id,
        entity_label=student_label,
        event_type=event_type,
        severity=severity,
        title=(title or f'Signal {subject} depuis Nexus AI')[:220],
        summary='\n'.join(summary_parts),
        metrics=metrics,
        snapshot=envelope,
        period_start=None,
        period_end=None,
    )
    notify_event_stakeholders(event)
    return event


def build_period_state_report(queryset, start=None, end=None):
    attendance_qs = Attendance.objects.all()
    grade_qs = Grade.objects.all()
    if start:
        attendance_qs = attendance_qs.filter(date__gte=start)
        grade_qs = grade_qs.filter(date__gte=start)
    if end:
        attendance_qs = attendance_qs.filter(date__lte=end)
        grade_qs = grade_qs.filter(date__lte=end)

    attendance = attendance_qs.aggregate(
        total=Count('id'),
        engaged=Count('id', filter=Q(status__in=['present', 'late', 'excused'])),
        absent=Count('id', filter=Q(status='absent')),
        late=Count('id', filter=Q(status='late')),
    )
    attendance_total = attendance['total'] or 0
    attendance_rate = round((attendance['engaged'] / attendance_total) * 100, 2) if attendance_total else None

    normalized_grades = [grade.excellence_percentage for grade in grade_qs.select_related('student')]
    average_grade = round(sum(normalized_grades) / len(normalized_grades), 2) if normalized_grades else None

    severity_counts = queryset.values('severity').annotate(total=Count('id')).order_by('severity')
    type_counts = queryset.values('event_type').annotate(total=Count('id')).order_by('event_type')
    at_risk_students = queryset.filter(severity__in=[
        EvolutionEvent.SEVERITY_WARNING,
        EvolutionEvent.SEVERITY_CRITICAL,
    ]).exclude(subject_student=None).values('subject_student').distinct().count()
    nexus_events = queryset.filter(event_type__in=[
        EvolutionEvent.EVENT_NEXUS_ACADEMIC,
        EvolutionEvent.EVENT_NEXUS_GRADE,
        EvolutionEvent.EVENT_NEXUS_PEDAGOGY,
        EvolutionEvent.EVENT_NEXUS_AI,
    ])
    nexus_percentages = [
        float(event.metrics['percentage'])
        for event in nexus_events
        if event.metrics.get('percentage') not in [None, '']
    ]

    return {
        'period': {
            'start': start,
            'end': end,
            'generated_at': timezone.localtime(timezone.now()),
        },
        'population': {
            'active_students': Student.objects.filter(is_active=True).count(),
            'active_employees': Teacher.objects.filter(is_active=True).count(),
            'classes': Class.objects.count(),
        },
        'attendance': {
            'records': attendance_total,
            'rate': attendance_rate,
            'absences': attendance['absent'] or 0,
            'lates': attendance['late'] or 0,
        },
        'performance': {
            'grades': len(normalized_grades),
            'average_normalized': average_grade,
            'average_classical_equivalent': _classical_equivalent(average_grade),
            'nexus_academic_events': nexus_events.count(),
            'nexus_average_percentage': round(sum(nexus_percentages) / len(nexus_percentages), 2) if nexus_percentages else None,
        },
        'intelligence': {
            'events': queryset.count(),
            'alerts_sent': sum(event.alerts_sent for event in queryset),
            'at_risk_students': at_risk_students,
            'severity_counts': {item['severity']: item['total'] for item in severity_counts},
            'type_counts': {item['event_type']: item['total'] for item in type_counts},
        },
    }


def _report_summary_rows(report):
    period = report['period']
    return [
        ['Periode', period['start'] or 'Debut', period['end'] or 'Fin'],
        ['Generation', period['generated_at'].strftime('%Y-%m-%d %H:%M'), ''],
        ['Eleves actifs', report['population']['active_students'], ''],
        ['Employes actifs', report['population']['active_employees'], ''],
        ['Classes', report['population']['classes'], ''],
        ['Taux de présence', f"{report['attendance']['rate']}%" if report['attendance']['rate'] is not None else 'N/A', ''],
        ['Absences', report['attendance']['absences'], ''],
        ['Retards', report['attendance']['lates'], ''],
        ['Moyenne generale excellence', f"{report['performance']['average_normalized']}%" if report['performance']['average_normalized'] is not None else 'N/A', '70% = 50% classique'],
        ['Equivalent classique', f"{report['performance']['average_classical_equivalent']}%" if report['performance']['average_classical_equivalent'] is not None else 'N/A', ''],
        ['Signaux académiques Nexus', report['performance']['nexus_academic_events'], ''],
        ['Moyenne Nexus %', f"{report['performance']['nexus_average_percentage']}%" if report['performance']['nexus_average_percentage'] is not None else 'N/A', ''],
        ['Evenements traces', report['intelligence']['events'], ''],
        ['Alertes envoyees', report['intelligence']['alerts_sent'], ''],
        ['Eleves a suivre', report['intelligence']['at_risk_students'], ''],
    ]


def export_events_csv(queryset, start=None, end=None):
    report = build_period_state_report(queryset, start=start, end=end)
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rapport de vie de l'écosystème"])
    writer.writerows(_report_summary_rows(report))
    writer.writerow([])
    writer.writerow(['Date', 'Entite', 'Type', 'Severite', 'Titre', 'Resume', 'Alertes'])
    for event in queryset:
        writer.writerow([
            timezone.localtime(event.created_at).strftime('%Y-%m-%d %H:%M'),
            event.entity_label,
            event.event_type,
            event.severity,
            event.title,
            event.summary.replace('\n', ' '),
            event.alerts_sent,
        ])
    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="rapport-evolution-ecosysteme.csv"'
    return response


def export_events_excel(queryset, start=None, end=None):
    report = build_period_state_report(queryset, start=start, end=end)
    rows = []
    rows.append("<h1>Rapport de vie de l'écosystème</h1>")
    rows.append('<h2>Synthese de periode</h2><table border="1">')
    for label, value, extra in _report_summary_rows(report):
        rows.append(f'<tr><th>{label}</th><td>{value}</td><td>{extra}</td></tr>')
    rows.append('</table><h2>Chronologie retracable</h2><table border="1">')
    rows.append('<tr><th>Date</th><th>Entite</th><th>Type</th><th>Severite</th><th>Signal</th><th>Resume</th><th>Alertes</th></tr>')
    for event in queryset:
        created_at = timezone.localtime(event.created_at).strftime('%Y-%m-%d %H:%M')
        rows.append(
            '<tr>'
            f'<td>{created_at}</td><td>{event.entity_label}</td><td>{event.event_type}</td>'
            f'<td>{event.severity}</td><td>{event.title}</td><td>{event.summary.replace(chr(10), " ")}</td>'
            f'<td>{event.alerts_sent}</td>'
            '</tr>'
        )
    rows.append('</table>')
    response = HttpResponse('\n'.join(rows), content_type='application/vnd.ms-excel; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="rapport-vie-ecosysteme.xls"'
    return response


def export_events_pdf(queryset, start=None, end=None, title="Rapport de vie de l'écosystème"):
    report = build_period_state_report(queryset, start=start, end=end)
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    summary_table = Table(_report_summary_rows(report), colWidths=[180, 120, 120])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#d1d5db')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ]))

    rows = [['Date', 'Entite', 'Type', 'Severite', 'Signal', 'Alertes']]
    for event in queryset:
        rows.append([
            timezone.localtime(event.created_at).strftime('%Y-%m-%d %H:%M'),
            event.entity_label,
            event.event_type,
            event.severity,
            Paragraph(event.title, styles['BodyText']),
            str(event.alerts_sent),
        ])

    table = Table(rows, repeatRows=1, colWidths=[90, 150, 80, 80, 330, 55])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#111827')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#d1d5db')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story = [
        Paragraph(title, styles['Title']),
        Spacer(1, 8),
        Paragraph('Synthese de periode', styles['Heading2']),
        summary_table,
        Spacer(1, 12),
        Paragraph('Chronologie retracable des evolutions', styles['Heading2']),
        table,
    ]
    document.build(story)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="rapport-vie-ecosysteme.pdf"'
    return response
