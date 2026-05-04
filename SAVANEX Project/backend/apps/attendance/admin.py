from django.contrib import admin
from .models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'class_subject', 'date', 'status', 'recorded_by')
    list_filter = ('status', 'date', 'class_subject')
    search_fields = ('student__student_id', 'student__user__first_name', 'student__user__last_name')
