from django.contrib import admin
from .models import AcademicYear, Level, Class, Subject, ClassSubject

admin.site.register(AcademicYear)
admin.site.register(Level)
admin.site.register(Class)
admin.site.register(Subject)
admin.site.register(ClassSubject)
