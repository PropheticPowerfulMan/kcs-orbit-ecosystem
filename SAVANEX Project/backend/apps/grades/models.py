"""
Grades app — Score entry, averages, and report card generation.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Grade(models.Model):
    TYPE_EXAM = 'exam'
    TYPE_QUIZ = 'quiz'
    TYPE_ASSIGNMENT = 'assignment'
    TYPE_PROJECT = 'project'
    TYPE_PARTICIPATION = 'participation'

    GRADE_TYPE_CHOICES = [
        (TYPE_EXAM, _('Exam')),
        (TYPE_QUIZ, _('Quiz')),
        (TYPE_ASSIGNMENT, _('Assignment')),
        (TYPE_PROJECT, _('Project')),
        (TYPE_PARTICIPATION, _('Participation')),
    ]

    TERM_CHOICES = [
        ('T1', _('Term 1')),
        ('T2', _('Term 2')),
        ('T3', _('Term 3')),
    ]

    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='grades',
        verbose_name=_('Student'),
    )
    class_subject = models.ForeignKey(
        'classes.ClassSubject',
        on_delete=models.CASCADE,
        related_name='grades',
        verbose_name=_('Class / Subject'),
    )
    academic_year = models.ForeignKey(
        'classes.AcademicYear',
        on_delete=models.CASCADE,
        related_name='grades',
        verbose_name=_('Academic Year'),
    )
    term = models.CharField(
        max_length=5,
        choices=TERM_CHOICES,
        verbose_name=_('Term'),
    )
    grade_type = models.CharField(
        max_length=20,
        choices=GRADE_TYPE_CHOICES,
        verbose_name=_('Type'),
    )
    score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        verbose_name=_('Score'),
    )
    max_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=20.00,
        verbose_name=_('Max Score'),
    )
    weight = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=1.0,
        verbose_name=_('Weight'),
    )
    date = models.DateField(verbose_name=_('Date'))
    comment = models.TextField(blank=True, verbose_name=_('Comment'))
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='entered_grades',
        verbose_name=_('Entered By'),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'grades'
        verbose_name = _('Grade')
        verbose_name_plural = _('Grades')
        ordering = ['-date']

    def __str__(self):
        return f"{self.student} — {self.class_subject.subject} — {self.score}/{self.max_score}"

    @property
    def percentage(self):
        if self.max_score > 0:
            return round(float(self.score) / float(self.max_score) * 100, 2)
        return 0.0

    @property
    def normalized_score(self):
        """Normalized to /20 for consistency."""
        if self.max_score > 0:
            return round(float(self.score) / float(self.max_score) * 20, 2)
        return 0.0


class ReportCard(models.Model):
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='report_cards',
        verbose_name=_('Student'),
    )
    academic_year = models.ForeignKey(
        'classes.AcademicYear',
        on_delete=models.CASCADE,
        related_name='report_cards',
        verbose_name=_('Academic Year'),
    )
    term = models.CharField(max_length=5, choices=Grade.TERM_CHOICES, verbose_name=_('Term'))
    overall_average = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Overall Average'),
    )
    rank = models.PositiveIntegerField(null=True, blank=True, verbose_name=_('Rank'))
    teacher_comment = models.TextField(blank=True, verbose_name=_('Teacher Comment'))
    generated_at = models.DateTimeField(auto_now_add=True)
    data = models.JSONField(default=dict, verbose_name=_('Report Data'))

    class Meta:
        db_table = 'report_cards'
        verbose_name = _('Report Card')
        verbose_name_plural = _('Report Cards')
        unique_together = ['student', 'academic_year', 'term']

    def __str__(self):
        return f"{self.student} — {self.academic_year} — {self.term}"
