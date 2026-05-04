"""
Timetable app — Smart scheduling with conflict detection.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError


class TimeSlot(models.Model):
    DAY_CHOICES = [
        (0, _('Monday')),
        (1, _('Tuesday')),
        (2, _('Wednesday')),
        (3, _('Thursday')),
        (4, _('Friday')),
        (5, _('Saturday')),
    ]

    class_subject = models.ForeignKey(
        'classes.ClassSubject',
        on_delete=models.CASCADE,
        related_name='time_slots',
        verbose_name=_('Class / Subject'),
    )
    academic_year = models.ForeignKey(
        'classes.AcademicYear',
        on_delete=models.CASCADE,
        related_name='time_slots',
        verbose_name=_('Academic Year'),
    )
    day_of_week = models.IntegerField(choices=DAY_CHOICES, verbose_name=_('Day'))
    start_time = models.TimeField(verbose_name=_('Start Time'))
    end_time = models.TimeField(verbose_name=_('End Time'))
    room = models.CharField(max_length=50, blank=True, verbose_name=_('Room'))

    class Meta:
        db_table = 'time_slots'
        verbose_name = _('Time Slot')
        verbose_name_plural = _('Time Slots')
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return (
            f"{self.class_subject} — "
            f"{self.get_day_of_week_display()} "
            f"{self.start_time:%H:%M}-{self.end_time:%H:%M}"
        )

    def clean(self):
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValidationError(_('Start time must be before end time.'))
