"""
Communication app — Threaded messages and in-app notifications.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class Message(models.Model):
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
        verbose_name=_('Sender'),
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages',
        verbose_name=_('Receiver'),
    )
    subject = models.CharField(max_length=200, verbose_name=_('Subject'))
    body = models.TextField(verbose_name=_('Body'))
    sent_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    is_read = models.BooleanField(default=False, verbose_name=_('Read'))
    parent_message = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
        verbose_name=_('Reply To'),
    )

    class Meta:
        db_table = 'messages'
        verbose_name = _('Message')
        verbose_name_plural = _('Messages')
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.sender} → {self.receiver}: {self.subject}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class Notification(models.Model):
    TYPE_ATTENDANCE = 'attendance'
    TYPE_GRADE = 'grade'
    TYPE_MESSAGE = 'message'
    TYPE_ANNOUNCEMENT = 'announcement'
    TYPE_WARNING = 'warning'

    NOTIF_TYPES = [
        (TYPE_ATTENDANCE, _('Attendance Alert')),
        (TYPE_GRADE, _('Grade Published')),
        (TYPE_MESSAGE, _('New Message')),
        (TYPE_ANNOUNCEMENT, _('Announcement')),
        (TYPE_WARNING, _('Performance Warning')),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_('User'),
    )
    title = models.CharField(max_length=200, verbose_name=_('Title'))
    body = models.TextField(verbose_name=_('Body'))
    notif_type = models.CharField(
        max_length=20,
        choices=NOTIF_TYPES,
        default=TYPE_ANNOUNCEMENT,
        verbose_name=_('Type'),
    )
    is_read = models.BooleanField(default=False, verbose_name=_('Read'))
    created_at = models.DateTimeField(auto_now_add=True)
    link = models.CharField(max_length=200, blank=True, verbose_name=_('Link'))

    class Meta:
        db_table = 'notifications'
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} — {self.title}"
