"""
Users app — Custom user model with role-based access control.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """
    Extended user model supporting Admin, Teacher, Student, and Parent roles.
    """
    ROLE_ADMIN = 'admin'
    ROLE_TEACHER = 'teacher'
    ROLE_STUDENT = 'student'
    ROLE_PARENT = 'parent'

    ROLE_CHOICES = [
        (ROLE_ADMIN, _('Admin')),
        (ROLE_TEACHER, _('Teacher')),
        (ROLE_STUDENT, _('Student')),
        (ROLE_PARENT, _('Parent')),
    ]

    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('fr', 'Français'),
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_STUDENT,
        verbose_name=_('Role'),
    )
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Phone'))
    avatar = models.ImageField(
        upload_to='avatars/',
        blank=True,
        null=True,
        verbose_name=_('Avatar'),
    )
    language = models.CharField(
        max_length=5,
        choices=LANGUAGE_CHOICES,
        default='en',
        verbose_name=_('Preferred Language'),
    )
    dark_mode = models.BooleanField(default=True, verbose_name=_('Dark Mode'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = _('User')
        verbose_name_plural = _('Users')

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    @property
    def is_teacher(self):
        return self.role == self.ROLE_TEACHER

    @property
    def is_student(self):
        return self.role == self.ROLE_STUDENT

    @property
    def is_parent(self):
        return self.role == self.ROLE_PARENT
