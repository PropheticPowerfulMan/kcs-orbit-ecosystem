from django.contrib import admin
from .models import Teacher


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('teacher_id', 'user', 'specialization', 'is_active')
    list_filter = ('specialization', 'is_active')
    search_fields = ('teacher_id', 'user__first_name', 'user__last_name', 'user__email')
