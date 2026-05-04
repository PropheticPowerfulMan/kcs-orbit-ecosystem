"""
Attendance app — Daily attendance tracking with automated alerts.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Attendance(models.Model):
    STATUS_PRESENT = 'present'
    STATUS_ABSENT = 'absent'
    STATUS_LATE = 'late'
    STATUS_EXCUSED = 'excused'

    STATUS_CHOICES = [
        (STATUS_PRESENT, _('Present')),
        (STATUS_ABSENT, _('Absent')),
        (STATUS_LATE, _('Late')),
        (STATUS_EXCUSED, _('Excused')),
    ]

    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name=_('Student'),
    )
    class_subject = models.ForeignKey(
        'classes.ClassSubject',
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name=_('Class / Subject'),
    )
    date = models.DateField(verbose_name=_('Date'))
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_PRESENT,
        verbose_name=_('Status'),
    )
    notes = models.TextField(blank=True, verbose_name=_('Notes'))
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_attendances',
        verbose_name=_('Recorded By'),
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance'
        verbose_name = _('Attendance')
        verbose_name_plural = _('Attendance Records')
        unique_together = ['student', 'class_subject', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.student} — {self.date} — {self.get_status_display()}"
