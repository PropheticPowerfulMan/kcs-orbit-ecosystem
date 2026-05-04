from django.contrib import admin
from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'user', 'current_class', 'is_active')
    list_filter = ('gender', 'is_active', 'current_class')
    search_fields = ('student_id', 'user__first_name', 'user__last_name', 'user__email')
