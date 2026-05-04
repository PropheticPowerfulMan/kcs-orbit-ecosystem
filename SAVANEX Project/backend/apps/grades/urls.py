from django.urls import path
from .views import (
    GradeListCreateView,
    GradeDetailView,
    ReportCardListCreateView,
    generate_report_card,
)

urlpatterns = [
    path('', GradeListCreateView.as_view(), name='grade-list-create'),
    path('<int:pk>/', GradeDetailView.as_view(), name='grade-detail'),
    path('report-cards/', ReportCardListCreateView.as_view(), name='report-card-list-create'),
    path('report-cards/generate/', generate_report_card, name='report-card-generate'),
]
