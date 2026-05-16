from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils.translation import gettext_lazy as _


class EvolutionEvent(models.Model):
    SEVERITY_INFO = 'info'
    SEVERITY_SUCCESS = 'success'
    SEVERITY_WARNING = 'warning'
    SEVERITY_CRITICAL = 'critical'

    SEVERITY_CHOICES = [
        (SEVERITY_INFO, _('Information')),
        (SEVERITY_SUCCESS, _('Positive Evolution')),
        (SEVERITY_WARNING, _('Warning')),
        (SEVERITY_CRITICAL, _('Critical Alert')),
    ]

    EVENT_GRADE = 'grade'
    EVENT_ATTENDANCE = 'attendance'
    EVENT_PROFILE = 'profile'
    EVENT_REPORT_CARD = 'report_card'
    EVENT_NEXUS_ACADEMIC = 'nexus_academic'
    EVENT_NEXUS_GRADE = 'nexus_grade'
    EVENT_NEXUS_PEDAGOGY = 'nexus_pedagogy'
    EVENT_NEXUS_AI = 'nexus_ai'
    EVENT_SYSTEM = 'system'

    EVENT_TYPE_CHOICES = [
        (EVENT_GRADE, _('Grade')),
        (EVENT_ATTENDANCE, _('Attendance')),
        (EVENT_PROFILE, _('Profile')),
        (EVENT_REPORT_CARD, _('Report Card')),
        (EVENT_NEXUS_ACADEMIC, _('Nexus Academic Signal')),
        (EVENT_NEXUS_GRADE, _('Nexus Grade')),
        (EVENT_NEXUS_PEDAGOGY, _('Nexus Pedagogy')),
        (EVENT_NEXUS_AI, _('Nexus AI Recommendation')),
        (EVENT_SYSTEM, _('System')),
    ]

    content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.SET_NULL)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    subject_student = models.ForeignKey(
        'students.Student',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='evolution_events',
        verbose_name=_('Concerned Student'),
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='evolution_events_created',
        verbose_name=_('Actor'),
    )
    entity_type = models.CharField(max_length=80, verbose_name=_('Entity Type'))
    entity_id = models.CharField(max_length=80, blank=True, verbose_name=_('Entity ID'))
    entity_label = models.CharField(max_length=220, verbose_name=_('Entity Label'))
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES, default=EVENT_SYSTEM)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default=SEVERITY_INFO)
    title = models.CharField(max_length=220)
    summary = models.TextField(blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    snapshot = models.JSONField(default=dict, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    alerts_sent = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evolution_events'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', 'severity']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['period_start', 'period_end']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.entity_label} - {self.title}'


class EvolutionAlertDelivery(models.Model):
    CHANNEL_IN_APP = 'in_app'
    CHANNEL_EMAIL = 'email'
    CHANNEL_SMS = 'sms'

    CHANNEL_CHOICES = [
        (CHANNEL_IN_APP, _('In App')),
        (CHANNEL_EMAIL, _('Email')),
        (CHANNEL_SMS, _('SMS')),
    ]

    event = models.ForeignKey(EvolutionEvent, on_delete=models.CASCADE, related_name='deliveries')
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='evolution_alert_deliveries',
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=30)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evolution_alert_deliveries'
        ordering = ['-created_at']
