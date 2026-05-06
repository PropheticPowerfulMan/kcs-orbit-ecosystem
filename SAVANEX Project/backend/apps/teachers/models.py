"""
Teachers app — Teacher profiles, qualifications, and subject assignments.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from uuid import uuid4


def generate_employee_id():
    return f"SAV-EMP-{uuid4().hex[:8].upper()}"


class Teacher(models.Model):
    EMPLOYEE_TYPE_TEACHER = 'teacher'
    EMPLOYEE_TYPE_ADMINISTRATIVE = 'administrative'
    EMPLOYEE_TYPE_SUPPORT = 'support'
    EMPLOYEE_TYPE_LEADERSHIP = 'leadership'
    EMPLOYEE_TYPE_SPECIALIST = 'specialist'

    EMPLOYEE_TYPE_CHOICES = [
        (EMPLOYEE_TYPE_TEACHER, _('Teacher')),
        (EMPLOYEE_TYPE_ADMINISTRATIVE, _('Administrative Staff')),
        (EMPLOYEE_TYPE_SUPPORT, _('Support Staff')),
        (EMPLOYEE_TYPE_LEADERSHIP, _('Leadership')),
        (EMPLOYEE_TYPE_SPECIALIST, _('Specialist')),
    ]

    CONTRACT_TYPE_PERMANENT = 'permanent'
    CONTRACT_TYPE_TEMPORARY = 'temporary'
    CONTRACT_TYPE_PART_TIME = 'part_time'
    CONTRACT_TYPE_CONSULTANT = 'consultant'

    CONTRACT_TYPE_CHOICES = [
        (CONTRACT_TYPE_PERMANENT, _('Permanent')),
        (CONTRACT_TYPE_TEMPORARY, _('Temporary')),
        (CONTRACT_TYPE_PART_TIME, _('Part Time')),
        (CONTRACT_TYPE_CONSULTANT, _('Consultant')),
    ]

    STATUS_ACTIVE = 'active'
    STATUS_ON_LEAVE = 'on_leave'
    STATUS_SUSPENDED = 'suspended'
    STATUS_INACTIVE = 'inactive'

    EMPLOYMENT_STATUS_CHOICES = [
        (STATUS_ACTIVE, _('Active')),
        (STATUS_ON_LEAVE, _('On Leave')),
        (STATUS_SUSPENDED, _('Suspended')),
        (STATUS_INACTIVE, _('Inactive')),
    ]

    PAY_FREQUENCY_MONTHLY = 'monthly'
    PAY_FREQUENCY_WEEKLY = 'weekly'
    PAY_FREQUENCY_DAILY = 'daily'
    PAY_FREQUENCY_HOURLY = 'hourly'

    PAY_FREQUENCY_CHOICES = [
        (PAY_FREQUENCY_MONTHLY, _('Monthly')),
        (PAY_FREQUENCY_WEEKLY, _('Weekly')),
        (PAY_FREQUENCY_DAILY, _('Daily')),
        (PAY_FREQUENCY_HOURLY, _('Hourly')),
    ]

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
    employee_id = models.CharField(
        max_length=20,
        unique=True,
        default=generate_employee_id,
        verbose_name=_('Employee ID'),
    )
    employee_type = models.CharField(
        max_length=20,
        choices=EMPLOYEE_TYPE_CHOICES,
        default=EMPLOYEE_TYPE_TEACHER,
        verbose_name=_('Employee Type'),
    )
    department = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_('Department'),
    )
    job_title = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_('Job Title'),
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
    end_date = models.DateField(
        blank=True,
        null=True,
        verbose_name=_('End Date'),
    )
    contract_type = models.CharField(
        max_length=20,
        blank=True,
        choices=CONTRACT_TYPE_CHOICES,
        verbose_name=_('Contract Type'),
    )
    employment_status = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_STATUS_CHOICES,
        default=STATUS_ACTIVE,
        verbose_name=_('Employment Status'),
    )
    work_location = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_('Work Location'),
    )
    payroll_reference = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('Payroll Reference'),
    )
    national_id_number = models.CharField(
        max_length=60,
        blank=True,
        verbose_name=_('National ID Number'),
    )
    social_security_number = models.CharField(
        max_length=60,
        blank=True,
        verbose_name=_('Social Security Number'),
    )
    tax_number = models.CharField(
        max_length=60,
        blank=True,
        verbose_name=_('Tax Number'),
    )
    bank_name = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_('Bank Name'),
    )
    bank_account_number = models.CharField(
        max_length=80,
        blank=True,
        verbose_name=_('Bank Account Number'),
    )
    salary_grade = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('Salary Grade'),
    )
    base_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name=_('Base Salary'),
    )
    pay_frequency = models.CharField(
        max_length=20,
        blank=True,
        choices=PAY_FREQUENCY_CHOICES,
        default=PAY_FREQUENCY_MONTHLY,
        verbose_name=_('Pay Frequency'),
    )
    supervisor_name = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_('Supervisor Name'),
    )
    office_phone_extension = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Office Phone Extension'),
    )
    work_email = models.EmailField(
        blank=True,
        verbose_name=_('Work Email'),
    )
    emergency_contact_name = models.CharField(
        max_length=120,
        blank=True,
        verbose_name=_('Emergency Contact Name'),
    )
    emergency_contact_phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Emergency Contact Phone'),
    )
    bio = models.TextField(blank=True, verbose_name=_('Biography'))
    employment_notes = models.TextField(blank=True, verbose_name=_('Employment Notes'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))

    class Meta:
        db_table = 'teachers'
        verbose_name = _('Employee')
        verbose_name_plural = _('Employees')
        ordering = ['user__last_name', 'user__first_name']

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.teacher_id})"

    def save(self, *args, **kwargs):
        if not self.job_title and self.employee_type == self.EMPLOYEE_TYPE_TEACHER:
            self.job_title = 'Teacher'
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        return self.user.get_full_name()

    @property
    def employee_label(self):
        return self.get_employee_type_display()

    @property
    def is_teaching_employee(self):
        return self.employee_type == self.EMPLOYEE_TYPE_TEACHER
