from django.contrib import admin
from .models import Teacher


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'teacher_id', 'employee_type', 'department', 'job_title', 'employment_status', 'is_active')
    list_filter = ('employee_type', 'department', 'employment_status', 'contract_type', 'pay_frequency', 'is_active')
    search_fields = ('teacher_id', 'employee_id', 'job_title', 'work_email', 'national_id_number', 'user__first_name', 'user__last_name', 'user__email')
