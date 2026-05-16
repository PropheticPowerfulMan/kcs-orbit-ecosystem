from datetime import timedelta
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.classes.models import Class
from apps.attendance.models import Attendance
from apps.grades.models import Grade


def _normalized_average(grades):
    values = [grade.excellence_percentage for grade in grades]
    return round(sum(values) / len(values), 2) if values else None


def _classical_equivalent(excellence_percentage):
    if excellence_percentage is None:
        return None
    if excellence_percentage <= 75:
        return round(excellence_percentage * (50 / 75), 2)
    return round(50 + ((excellence_percentage - 75) * 2), 2)


def _attendance_rate(queryset):
    total = queryset.count()
    if not total:
        return None

    present_like = queryset.filter(status__in=['present', 'late', 'excused']).count()
    return round((present_like / total) * 100, 2)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def overview(request):
    total_students = Student.objects.filter(is_active=True).count()
    total_teachers = Teacher.objects.filter(is_active=True).count()
    total_classes = Class.objects.count()

    # Attendance stats for the last 30 days
    since = timezone.now().date() - timedelta(days=30)
    attendance_qs = Attendance.objects.filter(date__gte=since)
    attendance_rate = _attendance_rate(attendance_qs)

    grades = list(Grade.objects.select_related('student'))
    avg_grade = _normalized_average(grades)

    return Response({
        'total_students': total_students,
        'total_teachers': total_teachers,
        'total_classes': total_classes,
        'attendance_rate_30d': attendance_rate,
        'average_grade': avg_grade,
        'average_excellence_percentage': avg_grade,
        'average_classical_equivalent_percentage': _classical_equivalent(avg_grade),
        'data_quality': {
            'is_real_ecosystem_data': True,
            'attendance_records_30d': attendance_qs.count(),
            'grade_records': len(grades),
            'attendance_rate_is_available': attendance_rate is not None,
            'average_grade_is_available': avg_grade is not None,
            'notes': [
                'Les moyennes sont exprimees sur 100% selon la cotation d excellence.',
                'Dans cette echelle, 75% excellence equivaut a 50% classique.',
                'Les indicateurs sans donnees restent null au lieu d etre remplaces par une valeur artificielle.',
            ],
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def early_warning(request):
    """
    Identify students with weak attendance (<75%) or low excellence average (<75%).
    """
    warnings = []

    students = Student.objects.filter(is_active=True).select_related('user')
    for student in students:
        attendance = Attendance.objects.filter(student=student)
        attendance_rate = _attendance_rate(attendance)

        grades = Grade.objects.filter(student=student)
        avg_normalized = _normalized_average(list(grades))

        risk_flags = []
        data_gaps = []
        if attendance_rate is None:
            data_gaps.append('no_attendance_data')
        elif attendance_rate < 75:
            risk_flags.append('low_attendance')

        if avg_normalized is None:
            data_gaps.append('no_grade_data')
        elif avg_normalized < 75:
            risk_flags.append('low_performance')

        if risk_flags or data_gaps:
            warnings.append({
                'student_id': student.id,
                'student_name': student.user.get_full_name(),
                'attendance_rate': attendance_rate,
                'average_normalized': avg_normalized,
                'average_excellence_percentage': avg_normalized,
                'average_classical_equivalent_percentage': _classical_equivalent(avg_normalized),
                'risk_flags': risk_flags,
                'data_gaps': data_gaps,
            })

    return Response({'count': len(warnings), 'students': warnings})
