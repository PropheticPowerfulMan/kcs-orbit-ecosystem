from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.integration.orbit import sync_grade
from apps.intelligence.services import observe_grade, observe_report_card
from .models import Grade, ReportCard
from .serializers import GradeSerializer, ReportCardSerializer
from apps.users.permissions import IsTeacherOrAdmin


class GradeListCreateView(generics.ListCreateAPIView):
    queryset = Grade.objects.select_related(
        'student__user', 'class_subject__subject', 'academic_year', 'entered_by'
    ).all()
    serializer_class = GradeSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ['student', 'class_subject', 'academic_year', 'term', 'grade_type']
    search_fields = ['student__student_id', 'student__user__first_name', 'student__user__last_name']

    def perform_create(self, serializer):
        grade = serializer.save(entered_by=self.request.user)
        sync_grade(grade)
        observe_grade(grade, actor=self.request.user)


class GradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Grade.objects.select_related(
        'student__user', 'class_subject__subject', 'academic_year', 'entered_by'
    ).all()
    serializer_class = GradeSerializer
    permission_classes = [IsTeacherOrAdmin]

    def perform_update(self, serializer):
        grade = serializer.save()
        sync_grade(grade)
        observe_grade(grade, actor=self.request.user)


class ReportCardListCreateView(generics.ListCreateAPIView):
    queryset = ReportCard.objects.select_related('student__user', 'academic_year').all()
    serializer_class = ReportCardSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ['student', 'academic_year', 'term']


@api_view(['POST'])
@permission_classes([IsTeacherOrAdmin])
def generate_report_card(request):
    student_id = request.data.get('student')
    academic_year_id = request.data.get('academic_year')
    term = request.data.get('term')

    if not all([student_id, academic_year_id, term]):
        return Response({'detail': 'student, academic_year and term are required.'}, status=400)

    grades = Grade.objects.filter(student_id=student_id, academic_year_id=academic_year_id, term=term)
    if not grades.exists():
        return Response({'detail': 'No grades found for this period.'}, status=404)

    subject_summaries = []
    weighted_sum = 0.0
    total_weights = 0.0

    for grade in grades:
        excellence = grade.excellence_percentage
        weight = float(grade.weight) * float(grade.class_subject.subject.coefficient)
        weighted_sum += excellence * weight
        total_weights += weight

        subject_summaries.append({
            'subject': grade.class_subject.subject.name,
            'score': float(grade.score),
            'max_score': float(grade.max_score),
            'excellence_percentage': excellence,
            'classical_equivalent_percentage': grade.classical_equivalent_percentage,
            'normalized_score': grade.normalized_score,
            'weight': float(grade.weight),
        })

    overall_average = round(weighted_sum / total_weights, 2) if total_weights else 0.0

    report, _ = ReportCard.objects.update_or_create(
        student_id=student_id,
        academic_year_id=academic_year_id,
        term=term,
        defaults={
            'overall_average': overall_average,
            'data': {'subjects': subject_summaries},
        },
    )
    observe_report_card(report)

    return Response(ReportCardSerializer(report).data, status=status.HTTP_201_CREATED)
