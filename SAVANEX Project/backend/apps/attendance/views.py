from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.integration.orbit import sync_attendance
from apps.intelligence.services import observe_attendance
from .models import Attendance
from .serializers import AttendanceSerializer, BulkAttendanceSerializer
from apps.users.permissions import IsTeacherOrAdmin


class AttendanceListCreateView(generics.ListCreateAPIView):
    queryset = Attendance.objects.select_related('student__user', 'class_subject__subject', 'recorded_by').all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ['date', 'status', 'class_subject', 'student']
    search_fields = ['student__student_id', 'student__user__first_name', 'student__user__last_name']

    def perform_create(self, serializer):
        attendance = serializer.save(recorded_by=self.request.user)
        sync_attendance(attendance)
        observe_attendance(attendance, actor=self.request.user)


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Attendance.objects.select_related('student__user', 'class_subject__subject', 'recorded_by').all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsTeacherOrAdmin]

    def perform_update(self, serializer):
        attendance = serializer.save()
        sync_attendance(attendance)
        observe_attendance(attendance, actor=self.request.user)


@api_view(['POST'])
@permission_classes([IsTeacherOrAdmin])
def bulk_attendance(request):
    serializer = BulkAttendanceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    class_subject_id = serializer.validated_data['class_subject']
    date = serializer.validated_data['date']
    records = serializer.validated_data['records']

    results = []
    for record in records:
        attendance, _ = Attendance.objects.update_or_create(
            student_id=record['student'],
            class_subject_id=class_subject_id,
            date=date,
            defaults={
                'status': record['status'],
                'notes': record.get('notes', ''),
                'recorded_by': request.user,
            },
        )
        sync_attendance(attendance)
        observe_attendance(attendance, actor=request.user)
        results.append(attendance.id)

    return Response({'detail': 'Bulk attendance saved.', 'records': results}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_report(request):
    student_id = request.query_params.get('student')
    queryset = Attendance.objects.all()

    if student_id:
        queryset = queryset.filter(student_id=student_id)

    grouped = queryset.values('student_id', 'student__user__first_name', 'student__user__last_name').annotate(
        total_sessions=Count('id'),
        present=Count('id', filter=Q(status='present')),
        absent=Count('id', filter=Q(status='absent')),
        late=Count('id', filter=Q(status='late')),
        excused=Count('id', filter=Q(status='excused')),
    )

    result = []
    for item in grouped:
        total = item['total_sessions'] or 1
        attendance_rate = ((item['present'] + item['late'] + item['excused']) / total) * 100
        result.append({
            'student_id': item['student_id'],
            'student_name': f"{item['student__user__first_name']} {item['student__user__last_name']}".strip(),
            'total_sessions': item['total_sessions'],
            'present': item['present'],
            'absent': item['absent'],
            'late': item['late'],
            'excused': item['excused'],
            'attendance_rate': round(attendance_rate, 2),
            'at_risk': attendance_rate < 75,
        })

    return Response(result)
