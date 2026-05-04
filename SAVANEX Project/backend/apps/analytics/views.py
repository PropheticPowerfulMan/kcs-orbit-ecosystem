from datetime import timedelta
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.classes.models import Class
from apps.attendance.models import Attendance
from apps.grades.models import Grade


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def overview(request):
    total_students = Student.objects.filter(is_active=True).count()
    total_teachers = Teacher.objects.filter(is_active=True).count()
    total_classes = Class.objects.count()

    # Attendance stats for the last 30 days
    since = timezone.now().date() - timedelta(days=30)
    attendance_qs = Attendance.objects.filter(date__gte=since)
    attendance_total = attendance_qs.count()
    present_like = attendance_qs.filter(status__in=['present', 'late', 'excused']).count()
    attendance_rate = round((present_like / attendance_total * 100), 2) if attendance_total else 0.0

    # Grade stats
    avg_grade = Grade.objects.aggregate(avg=Avg('score'))['avg'] or 0

    return Response({
        'total_students': total_students,
        'total_teachers': total_teachers,
        'total_classes': total_classes,
        'attendance_rate_30d': attendance_rate,
        'average_grade': round(float(avg_grade), 2),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def early_warning(request):
    """
    Identify students with weak attendance (<75%) or low normalized average (<10/20).
    """
    warnings = []

    students = Student.objects.filter(is_active=True).select_related('user')
    for student in students:
        attendance = Attendance.objects.filter(student=student)
        total_sessions = attendance.count()
        present_like = attendance.filter(status__in=['present', 'late', 'excused']).count()
        attendance_rate = (present_like / total_sessions * 100) if total_sessions else 100.0

        grades = Grade.objects.filter(student=student)
        avg_normalized = sum(g.normalized_score for g in grades) / grades.count() if grades.exists() else 20.0

        risk_flags = []
        if attendance_rate < 75:
            risk_flags.append('low_attendance')
        if avg_normalized < 10:
            risk_flags.append('low_performance')

        if risk_flags:
            warnings.append({
                'student_id': student.id,
                'student_name': student.user.get_full_name(),
                'attendance_rate': round(attendance_rate, 2),
                'average_normalized': round(avg_normalized, 2),
                'risk_flags': risk_flags,
            })

    return Response({'count': len(warnings), 'students': warnings})
