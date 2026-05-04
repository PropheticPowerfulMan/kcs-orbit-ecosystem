"""
Students app — Student profiles and enrollment management.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Student(models.Model):
    GENDER_CHOICES = [
        ('M', _('Male')),
        ('F', _('Female')),
        ('O', _('Other')),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile',
        verbose_name=_('User Account'),
    )
    student_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name=_('Student ID'),
    )
    date_of_birth = models.DateField(verbose_name=_('Date of Birth'))
    gender = models.CharField(
        max_length=1,
        choices=GENDER_CHOICES,
        verbose_name=_('Gender'),
    )
    address = models.TextField(blank=True, verbose_name=_('Address'))
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        limit_choices_to={'role': 'parent'},
        verbose_name=_('Parent / Guardian'),
    )
    current_class = models.ForeignKey(
        'classes.Class',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
        verbose_name=_('Current Class'),
    )
    enrollment_date = models.DateField(auto_now_add=True, verbose_name=_('Enrollment Date'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    notes = models.TextField(blank=True, verbose_name=_('Notes'))

    class Meta:
        db_table = 'students'
        verbose_name = _('Student')
        verbose_name_plural = _('Students')
        ordering = ['user__last_name', 'user__first_name']

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.student_id})"

    @property
    def full_name(self):
        return self.user.get_full_name()
