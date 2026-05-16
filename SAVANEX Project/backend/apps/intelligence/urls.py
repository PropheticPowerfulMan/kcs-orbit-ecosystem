from django.urls import path

from .views import EvolutionEventListView, export_evolution_report, ingest_nexus_academic, student_living_profile


urlpatterns = [
    path('events/', EvolutionEventListView.as_view(), name='evolution-events'),
    path('ingest/nexus/academic/', ingest_nexus_academic, name='ingest-nexus-academic'),
    path('students/<int:pk>/living-profile/', student_living_profile, name='student-living-profile'),
    path('reports/evolution/', export_evolution_report, name='evolution-report-export'),
]
