import base64
import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Avg, Count, Q
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)


@dataclass
class DeliveryResult:
    channel: str
    status: str
    detail: str = ''


def _school_sender_name():
    return getattr(settings, 'SCHOOL_NAME', 'SAVANEX School')


def _normalize_phone(phone):
    return ''.join(char for char in (phone or '').strip() if char == '+' or char.isdigit())


def _send_parent_email(parent, subject, body):
    if not parent.email:
        return DeliveryResult('email', 'skipped', 'Parent email is missing.')

    try:
        sent_count = send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[parent.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.exception('Unable to send parent email to %s', parent.email)
        return DeliveryResult('email', 'failed', str(exc))

    return DeliveryResult('email', 'sent' if sent_count else 'failed', parent.email)


def _post_json(url, payload, headers=None, timeout=10):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', **(headers or {})},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read().decode('utf-8', errors='ignore')


def _send_sms_with_webhook(phone, body):
    webhook_url = getattr(settings, 'SMS_WEBHOOK_URL', '')
    if not webhook_url:
        return None

    headers = {}
    token = getattr(settings, 'SMS_WEBHOOK_TOKEN', '')
    if token:
        headers['Authorization'] = f'Bearer {token}'

    status, response_body = _post_json(webhook_url, {'to': phone, 'message': body}, headers=headers)
    if 200 <= status < 300:
        return DeliveryResult('sms', 'sent', response_body[:160])
    return DeliveryResult('sms', 'failed', f'Webhook returned {status}: {response_body[:160]}')


def _send_sms_with_twilio(phone, body):
    account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    from_number = getattr(settings, 'TWILIO_FROM_NUMBER', '')
    if not all([account_sid, auth_token, from_number]):
        return None

    endpoint = f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'
    encoded = urllib.parse.urlencode({'To': phone, 'From': from_number, 'Body': body}).encode('utf-8')
    credentials = base64.b64encode(f'{account_sid}:{auth_token}'.encode('utf-8')).decode('ascii')
    request = urllib.request.Request(
        endpoint,
        data=encoded,
        headers={
            'Authorization': f'Basic {credentials}',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        response_body = response.read().decode('utf-8', errors='ignore')
        if 200 <= response.status < 300:
            return DeliveryResult('sms', 'sent', response_body[:160])
        return DeliveryResult('sms', 'failed', f'Twilio returned {response.status}: {response_body[:160]}')


def _send_parent_sms(parent, body):
    phone = _normalize_phone(parent.phone)
    if not phone:
        return DeliveryResult('sms', 'skipped', 'Parent phone is missing.')

    if not getattr(settings, 'SMS_ENABLED', True):
        return DeliveryResult('sms', 'skipped', 'SMS delivery is disabled.')

    try:
        result = _send_sms_with_webhook(phone, body) or _send_sms_with_twilio(phone, body)
    except Exception as exc:
        logger.exception('Unable to send parent SMS to %s', phone)
        return DeliveryResult('sms', 'failed', str(exc))

    if result:
        return result
    logger.info('[sms simulated] to=%s body=%s', phone, body)
    return DeliveryResult('sms', 'simulated', 'Configure SMS_WEBHOOK_URL or Twilio settings for live SMS.')


def _short_sms(subject, body):
    text = f'{_school_sender_name()}: {subject}. {body}'.replace('\n', ' ')
    return text[:300]


def deliver_parent_communication(parent, subject, body, notif_type=Notification.TYPE_MESSAGE, link=''):
    if not parent:
        return []

    Notification.objects.create(
        user=parent,
        title=subject[:200],
        body=body,
        notif_type=notif_type,
        link=link,
    )

    return [
        _send_parent_email(parent, subject, body),
        _send_parent_sms(parent, _short_sms(subject, body)),
    ]


def summarize_student_evolution(student):
    from apps.attendance.models import Attendance
    from apps.grades.models import Grade

    since = timezone.localdate() - timedelta(days=30)
    attendance = Attendance.objects.filter(student=student, date__gte=since).aggregate(
        total=Count('id'),
        engaged=Count('id', filter=Q(status__in=['present', 'late', 'excused'])),
        absent=Count('id', filter=Q(status='absent')),
        late=Count('id', filter=Q(status='late')),
    )
    total = attendance['total'] or 0
    attendance_rate = round((attendance['engaged'] / total) * 100, 2) if total else None

    grades = Grade.objects.filter(student=student).order_by('-date', '-created_at')
    recent_grades = list(grades[:6])
    older_grades = list(grades[6:12])

    def average_normalized(items):
        if not items:
            return None
        total_score = sum(Decimal(str(item.excellence_percentage)) for item in items)
        return round(float(total_score / len(items)), 2)

    recent_average = average_normalized(recent_grades)
    previous_average = average_normalized(older_grades)
    trend = None
    if recent_average is not None and previous_average is not None:
        trend = round(recent_average - previous_average, 2)

    return {
        'attendance_rate': attendance_rate,
        'absences_30d': attendance['absent'] or 0,
        'lates_30d': attendance['late'] or 0,
        'recent_average': recent_average,
        'previous_average': previous_average,
        'trend': trend,
    }


def build_evolution_message(student, trigger_label):
    summary = summarize_student_evolution(student)
    name = student.full_name or str(student)
    lines = [f'Bonjour, SAVANEX vous informe de l evolution de {name}.', f'Dernier signal: {trigger_label}.']

    if summary['recent_average'] is not None:
        lines.append(f'Moyenne excellence recente: {summary["recent_average"]}%.')
    if summary['trend'] is not None:
        if summary['trend'] <= -1:
            lines.append(f'Tendance: baisse de {abs(summary["trend"])} point(s). Un suivi est recommande.')
        elif summary['trend'] >= 1:
            lines.append(f'Tendance: progression de {summary["trend"]} point(s). Encouragez ces efforts.')
        else:
            lines.append('Tendance: stable.')
    if summary['attendance_rate'] is not None:
        lines.append(f'Presence sur 30 jours: {summary["attendance_rate"]}%.')
    if summary['absences_30d'] or summary['lates_30d']:
        lines.append(f'Absences recentes: {summary["absences_30d"]}; retards: {summary["lates_30d"]}.')

    lines.append('Merci de contacter l administration ou le titulaire si vous souhaitez un accompagnement.')
    return '\n'.join(lines), summary


def notify_parent_about_student_evolution(student, trigger_label, notif_type=Notification.TYPE_WARNING, force=False):
    parent = getattr(student, 'parent', None)
    if not parent:
        return []

    body, summary = build_evolution_message(student, trigger_label)
    should_notify = force
    if summary['attendance_rate'] is not None and summary['attendance_rate'] < 75:
        should_notify = True
    if summary['recent_average'] is not None and summary['recent_average'] < 75:
        should_notify = True
    if summary['trend'] is not None and abs(summary['trend']) >= 1:
        should_notify = True

    if not should_notify:
        return []

    subject = f'Suivi SAVANEX - {student.full_name or student.student_id}'
    return deliver_parent_communication(parent, subject, body, notif_type=notif_type, link='/communication')


def notify_parent_about_grade(grade):
    percentage = float(grade.percentage)
    trigger = f'note publiee en {grade.class_subject.subject.name}: {percentage:.0f}% excellence'
    return notify_parent_about_student_evolution(
        grade.student,
        trigger,
        notif_type=Notification.TYPE_GRADE if percentage >= 75 else Notification.TYPE_WARNING,
        force=True,
    )


def notify_parent_about_attendance(attendance):
    status_label = attendance.get_status_display()
    trigger = f'presence du {attendance.date}: {status_label}'
    return notify_parent_about_student_evolution(
        attendance.student,
        trigger,
        notif_type=Notification.TYPE_ATTENDANCE if attendance.status != 'present' else Notification.TYPE_WARNING,
        force=attendance.status in ['absent', 'late'],
    )
