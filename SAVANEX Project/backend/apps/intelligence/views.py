from django.conf import settings
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.students.models import Student
from apps.users.permissions import IsAdminUser, IsTeacherOrAdmin

from .models import EvolutionEvent
from .serializers import EvolutionEventSerializer
from .services import (
    analyze_student_evolution,
    export_events_csv,
    export_events_excel,
    export_events_pdf,
    ingest_nexus_academic_event,
)


def _filtered_events(request):
    queryset = EvolutionEvent.objects.select_related('subject_student__user', 'actor').prefetch_related('deliveries__recipient')
    student_id = request.query_params.get('student')
    event_type = request.query_params.get('event_type')
    severity = request.query_params.get('severity')
    start = parse_date(request.query_params.get('start') or '')
    end = parse_date(request.query_params.get('end') or '')

    if student_id:
        queryset = queryset.filter(subject_student_id=student_id)
    if event_type:
        queryset = queryset.filter(event_type=event_type)
    if severity:
        queryset = queryset.filter(severity=severity)
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)
    return queryset


class EvolutionEventListView(generics.ListAPIView):
    serializer_class = EvolutionEventSerializer
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        return _filtered_events(self.request)


@api_view(['GET'])
@permission_classes([IsTeacherOrAdmin])
def student_living_profile(request, pk):
    try:
        student = Student.objects.select_related('user', 'parent').get(pk=pk)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found.'}, status=404)

    severity, metrics, period_start, period_end = analyze_student_evolution(student)
    events = EvolutionEvent.objects.filter(subject_student=student).order_by('-created_at')[:20]
    return Response({
        'student': {'id': student.id, 'student_id': student.student_id, 'full_name': student.full_name},
        'severity': severity,
        'period_start': period_start,
        'period_end': period_end,
        'metrics': metrics,
        'timeline': EvolutionEventSerializer(events, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def export_evolution_report(request):
    queryset = _filtered_events(request).order_by('created_at')
    export_format = (request.query_params.get('format') or 'pdf').lower()
    start = parse_date(request.query_params.get('start') or '')
    end = parse_date(request.query_params.get('end') or '')
    if export_format == 'csv':
        return export_events_csv(queryset, start=start, end=end)
    if export_format in ['excel', 'xls', 'xlsx']:
        return export_events_excel(queryset, start=start, end=end)
    return export_events_pdf(queryset, start=start, end=end)


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_nexus_academic(request):
    expected_key = getattr(settings, 'INTELLIGENCE_INGEST_API_KEY', '')
    provided_key = request.headers.get('x-api-key', '')
    app_slug = request.headers.get('x-app-slug', request.data.get('sourceApp', 'KCS_NEXUS'))

    if expected_key and provided_key != expected_key:
        return Response({'detail': 'Invalid ingestion API key.'}, status=status.HTTP_403_FORBIDDEN)
    if str(app_slug).upper() not in ['KCS_NEXUS', 'NEXUS_AI', 'NEXUS']:
        return Response({'detail': 'Only Nexus academic events are accepted here.'}, status=status.HTTP_400_BAD_REQUEST)

    event = ingest_nexus_academic_event(request.data)
    return Response(EvolutionEventSerializer(event).data, status=status.HTTP_201_CREATED)
