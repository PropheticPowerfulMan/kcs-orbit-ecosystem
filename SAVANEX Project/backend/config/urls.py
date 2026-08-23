"""SAVANEX SMS URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.db import connection
from django.http import JsonResponse
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenBlacklistView,
)
from apps.users.views import CustomTokenObtainPairView, forgot_password, reset_password


def health_check(_request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        return JsonResponse({'status': 'ok', 'databaseReady': True})
    except Exception:
        return JsonResponse({'status': 'degraded', 'databaseReady': False}, status=503)

urlpatterns = [
    path('api/health/', health_check, name='health_check'),
    # Admin
    path('admin/', admin.site.urls),

    # Auth — JWT
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', TokenBlacklistView.as_view(), name='token_blacklist'),
    path('api/auth/forgot-password/', forgot_password, name='forgot_password'),
    path('api/auth/reset-password/', reset_password, name='reset_password'),

    # API modules
    path('api/users/', include('apps.users.urls')),
    path('api/students/', include('apps.students.urls')),
    path('api/teachers/', include('apps.teachers.urls')),
    path('api/classes/', include('apps.classes.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/grades/', include('apps.grades.urls')),
    path('api/timetable/', include('apps.timetable.urls')),
    path('api/communication/', include('apps.communication.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/intelligence/', include('apps.intelligence.urls')),
    path('api/integration/', include('apps.integration.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
