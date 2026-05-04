"""
Teachers app — Teacher profiles, qualifications, and subject assignments.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Teacher(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teacher_profile',
        verbose_name=_('User Account'),
    )
    teacher_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name=_('Teacher ID'),
    )
    qualification = models.CharField(
        max_length=200,
        blank=True,
        verbose_name=_('Qualification'),
    )
    specialization = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Specialization'),
    )
    hire_date = models.DateField(verbose_name=_('Hire Date'))
    bio = models.TextField(blank=True, verbose_name=_('Biography'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))

    class Meta:
        db_table = 'teachers'
        verbose_name = _('Teacher')
        verbose_name_plural = _('Teachers')
        ordering = ['user__last_name', 'user__first_name']

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.teacher_id})"

    @property
    def full_name(self):
        return self.user.get_full_name()
