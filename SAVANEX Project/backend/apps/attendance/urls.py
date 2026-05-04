from django.urls import path
from .views import (
    AttendanceListCreateView,
    AttendanceDetailView,
    bulk_attendance,
    attendance_report,
)

urlpatterns = [
    path('', AttendanceListCreateView.as_view(), name='attendance-list-create'),
    path('<int:pk>/', AttendanceDetailView.as_view(), name='attendance-detail'),
    path('bulk/', bulk_attendance, name='attendance-bulk'),
    path('reports/', attendance_report, name='attendance-report'),
]
