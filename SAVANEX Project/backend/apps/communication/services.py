import base64
import json
import logging
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.utils.html import escape, linebreaks

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
    cleaned = ''.join(char for char in (phone or '').strip() if char == '+' or char.isdigit())
    if cleaned.startswith('0') and 9 <= len(cleaned) - 1 <= 11:
        return f'+243{cleaned[1:]}'
    if cleaned.startswith('243') and 11 <= len(cleaned) <= 14:
        return f'+{cleaned}'
    return cleaned


LOGO_URL = 'https://kinshasachristianschool.org/icons/nexus-192.png'
SCHOOL_URL = 'https://kinshasachristianschool.org/'


def build_branded_email_html(subject, body, action_url='', action_label='Ouvrir SAVANEX'):
    safe_subject = escape(subject)
    safe_body = linebreaks(escape(body))
    action = f'<a href="{escape(action_url)}" style="display:inline-block;background:#ffcb05;color:#071d3a;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 22px;font-size:14px">{escape(action_label)}</a>' if action_url else ''
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{safe_subject}</title></head>
<body style="margin:0;background:#eef4fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4fb;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border-collapse:separate;border-spacing:0;overflow:hidden;border-radius:26px;box-shadow:0 20px 55px rgba(8,38,76,.16)">
<tr><td style="height:7px;background:#ffcb05"></td></tr><tr><td style="background:#08264c;padding:26px 30px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="width:64px;height:64px;background:#fff;border-radius:50%;padding:2px"><img src="{LOGO_URL}" width="60" height="60" alt="Kinshasa Christian School" style="display:block;width:60px;height:60px;border-radius:50%;object-fit:cover"></td><td style="padding-left:18px"><p style="margin:0 0 5px;color:#ffcb05;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase">SAVANEX · MESSAGE OFFICIEL</p><h1 style="margin:0;color:#fff;font-size:24px;line-height:1.25">{safe_subject}</h1><p style="margin:7px 0 0;color:#bdd7f5;font-size:13px">Letting Our Light Shine</p></td></tr></table></td></tr>
<tr><td style="background:#fff;padding:30px"><div style="border-left:5px solid #ffcb05;background:#f8fbff;border-radius:16px;padding:18px 20px;margin-bottom:22px"><strong style="color:#004080;font-size:13px">Kinshasa Christian School</strong><p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.55">Une communication academique securisee de SAVANEX.</p></div><div style="font-size:15px;line-height:1.65;color:#334155">{safe_body}</div><div style="margin-top:26px">{action}</div></td></tr>
<tr><td style="background:#004080;padding:20px 28px;text-align:center"><img src="{LOGO_URL}" width="34" height="34" alt="KCS" style="display:inline-block;vertical-align:middle;background:#fff;border-radius:50%;padding:2px"><p style="margin:9px 0 0;color:#fff;font-size:13px;font-weight:700">Kinshasa Christian School</p><p style="margin:5px 0 0;color:#b9d7f7;font-size:11px">Macampagne, Ngaliema · Notification automatisee SAVANEX</p></td></tr></table></td></tr></table></body></html>'''


def send_branded_email(to, subject, body, action_url='', action_label='Ouvrir SAVANEX'):
    message = EmailMultiAlternatives(subject, body, getattr(settings, 'DEFAULT_FROM_EMAIL', None), [to])
    message.attach_alternative(build_branded_email_html(subject, body, action_url, action_label), 'text/html')
    return message.send(fail_silently=False)

def _send_user_email(user, subject, body, label='User'):
    if not user.email:
        return DeliveryResult('email', 'skipped', f'{label} email is missing.')

    try:
        sent_count = send_branded_email(user.email, subject, body)

    except Exception as exc:
        logger.exception('Unable to send %s email to %s', label.lower(), user.email)
        return DeliveryResult('email', 'failed', str(exc))

    return DeliveryResult('email', 'sent' if sent_count else 'failed', user.email)


def _send_parent_email(parent, subject, body):
    return _send_user_email(parent, subject, body, 'Parent')


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


def _send_sms_with_africas_talking(phone, body):
    api_url = getattr(settings, 'AFRICASTALKING_API_URL', '')
    api_key = getattr(settings, 'AFRICASTALKING_API_KEY', '')
    username = getattr(settings, 'AFRICASTALKING_USERNAME', '')
    sender = getattr(settings, 'AFRICASTALKING_SENDER', '')
    if not all([api_url, api_key, username]):
        return None

    def submit(include_sender):
        payload = {'username': username, 'to': phone, 'message': body}
        if include_sender and sender:
            payload['from'] = sender
        request = urllib.request.Request(
            api_url,
            data=urllib.parse.urlencode(payload).encode('utf-8'),
            headers={'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'apiKey': api_key},
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, response.read().decode('utf-8', errors='ignore')
        except HTTPError as exc:
            return exc.code, exc.read().decode('utf-8', errors='ignore')

    def provider_accepted(status, response_body):
        try:
            parsed = json.loads(response_body or '{}')
        except json.JSONDecodeError:
            return False
        recipients = parsed.get('SMSMessageData', {}).get('Recipients', [])
        return 200 <= status < 300 and bool(recipients) and any(
            str(recipient.get('statusCode', '')) == '101'
            or any(label in str(recipient.get('status', '')).lower() for label in ('success', 'sent', 'submitted'))
            for recipient in recipients
        )

    status, response_body = submit(bool(sender))
    if provider_accepted(status, response_body):
        return DeliveryResult('sms', 'sent', response_body[:160])

    sender_rejected = any(label in response_body.lower() for label in (
        'sender', 'from', 'short code', 'shortcode', 'not allowed', 'not registered', 'invalid sender',
    ))
    if sender and sender_rejected:
        status, response_body = submit(False)
        if provider_accepted(status, response_body):
            logger.warning("SMS accepted after retrying without an Africa's Talking Sender ID.")
            return DeliveryResult('sms', 'sent', response_body[:160])

    return DeliveryResult('sms', 'failed', response_body[:160])


def _send_user_sms(user, body, label='User'):
    phone = _normalize_phone(user.phone)
    body = body if body.lstrip().upper().startswith('SAVANEX:') else f'SAVANEX: {body}'
    if not phone:
        return DeliveryResult('sms', 'skipped', f'{label} phone is missing.')

    if not getattr(settings, 'SMS_ENABLED', True):
        return DeliveryResult('sms', 'skipped', 'SMS delivery is disabled.')

    try:
        result = _send_sms_with_africas_talking(phone, body) or _send_sms_with_webhook(phone, body) or _send_sms_with_twilio(phone, body)
    except Exception as exc:
        logger.exception('Unable to send %s SMS to %s', label.lower(), phone)
        return DeliveryResult('sms', 'failed', str(exc))

    if result:
        return result
    logger.info('[sms simulated] to=%s body=%s', phone, body)
    return DeliveryResult('sms', 'simulated', 'Configure SMS_WEBHOOK_URL or Twilio settings for live SMS.')


def _send_parent_sms(parent, body):
    return _send_user_sms(parent, body, 'Parent')


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

    sms_result = _send_parent_sms(parent, _short_sms(subject, body))
    email_result = _send_parent_email(parent, subject, body)
    return [email_result, sms_result]


def deliver_user_communication(user, subject, body, notif_type=Notification.TYPE_MESSAGE, link=''):
    if not user:
        return []

    Notification.objects.create(
        user=user,
        title=subject[:200],
        body=body,
        notif_type=notif_type,
        link=link,
    )

    sms_result = _send_user_sms(user, _short_sms(subject, body))
    email_result = _send_user_email(user, subject, body)
    return [email_result, sms_result]


def deliver_employee_communication(employee, subject, body, notif_type=Notification.TYPE_MESSAGE, link=''):
    """Deliver once in-app, by SMS, and to the employee's selected email targets."""
    user = getattr(employee, 'user', None)
    if not user:
        return []

    Notification.objects.create(
        user=user,
        title=subject[:200],
        body=body,
        notif_type=notif_type,
        link=link,
    )

    preference = (getattr(employee, 'email_contact_preference', '') or 'work').lower()
    work_email = (getattr(employee, 'work_email', '') or user.email or '').strip().lower()
    personal_email = (getattr(employee, 'personal_email', '') or '').strip().lower()
    candidates = {
        'work': [work_email],
        'personal': [personal_email],
        'both': [work_email, personal_email],
    }.get(preference, [work_email])
    emails = list(dict.fromkeys(email for email in candidates if email))
    if not emails and work_email:
        emails = [work_email]

    sms_result = _send_user_sms(user, _short_sms(subject, body), 'Employee')
    email_results = [
        _send_user_email(SimpleNamespace(email=email), subject, body, 'Employee')
        for email in emails
    ]
    if not email_results:
        email_results = [DeliveryResult('email', 'skipped', 'Employee email is missing.')]

    return [*email_results, sms_result]

def deliver_direct_parent_contact(name='', email='', phone='', subject='', body='', channels=None):
    enabled_channels = set(channels or ['email', 'sms'])
    contact = SimpleNamespace(email=email or '', phone=phone or '')
    label = name or 'Parent'
    sms_result = (
        _send_user_sms(contact, _short_sms(subject, body), label)
        if 'sms' in enabled_channels
        else DeliveryResult('sms', 'skipped', 'SMS channel disabled.')
    )
    email_result = (
        _send_user_email(contact, subject, body, label)
        if 'email' in enabled_channels
        else DeliveryResult('email', 'skipped', 'Email channel disabled.')
    )
    return [email_result, sms_result]


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
    if summary['attendance_rate'] is not None and summary['attendance_rate'] < 70:
        should_notify = True
    if summary['recent_average'] is not None and summary['recent_average'] < 70:
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
        notif_type=Notification.TYPE_GRADE if percentage >= 70 else Notification.TYPE_WARNING,
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
