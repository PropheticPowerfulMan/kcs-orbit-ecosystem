"""
Classes app — Academic years, levels, classes, subjects, and assignments.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _


class AcademicYear(models.Model):
    name = models.CharField(max_length=20, unique=True, verbose_name=_('Name'))
    start_date = models.DateField(verbose_name=_('Start Date'))
    end_date = models.DateField(verbose_name=_('End Date'))
    is_current = models.BooleanField(default=False, verbose_name=_('Current Year'))

    class Meta:
        db_table = 'academic_years'
        verbose_name = _('Academic Year')
        verbose_name_plural = _('Academic Years')
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Ensure only one year is marked as current
        if self.is_current:
            AcademicYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class Level(models.Model):
    name = models.CharField(max_length=50, verbose_name=_('Level Name'))
    order = models.PositiveIntegerField(default=0, verbose_name=_('Display Order'))

    class Meta:
        db_table = 'levels'
        verbose_name = _('Level')
        verbose_name_plural = _('Levels')
        ordering = ['order']

    def __str__(self):
        return self.name


class Class(models.Model):
    name = models.CharField(max_length=50, verbose_name=_('Class Name'))
    level = models.ForeignKey(
        Level,
        on_delete=models.PROTECT,
        related_name='classes',
        verbose_name=_('Level'),
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name='classes',
        verbose_name=_('Academic Year'),
    )
    class_teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='homeroom_classes',
        verbose_name=_('Class Teacher'),
    )
    capacity = models.PositiveIntegerField(default=30, verbose_name=_('Capacity'))
    room = models.CharField(max_length=50, blank=True, verbose_name=_('Room'))

    class Meta:
        db_table = 'classes'
        verbose_name = _('Class')
        verbose_name_plural = _('Classes')
        unique_together = ['name', 'academic_year']
        ordering = ['level__order', 'name']

    def __str__(self):
        return f"{self.name} ({self.academic_year})"

    @property
    def student_count(self):
        return self.students.filter(is_active=True).count()


class Subject(models.Model):
    name = models.CharField(max_length=100, verbose_name=_('Subject Name'))
    code = models.CharField(max_length=20, unique=True, verbose_name=_('Code'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    credit_hours = models.PositiveIntegerField(default=1, verbose_name=_('Credit Hours'))
    coefficient = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=1.0,
        verbose_name=_('Coefficient'),
    )

    class Meta:
        db_table = 'subjects'
        verbose_name = _('Subject')
        verbose_name_plural = _('Subjects')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class ClassSubject(models.Model):
    """Links a subject to a class and assigns the teaching teacher."""
    class_instance = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name='class_subjects',
        verbose_name=_('Class'),
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='class_assignments',
        verbose_name=_('Subject'),
    )
    teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teaching_assignments',
        verbose_name=_('Teacher'),
    )

    class Meta:
        db_table = 'class_subjects'
        verbose_name = _('Class Subject')
        verbose_name_plural = _('Class Subjects')
        unique_together = ['class_instance', 'subject']

    def __str__(self):
        return f"{self.class_instance} — {self.subject}"
