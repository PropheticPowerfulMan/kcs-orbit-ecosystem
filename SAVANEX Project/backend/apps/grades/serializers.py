from rest_framework import serializers
from .models import Grade, ReportCard


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='class_subject.subject.name', read_only=True)
    percentage = serializers.FloatField(read_only=True)
    excellence_percentage = serializers.FloatField(read_only=True)
    classical_equivalent_percentage = serializers.FloatField(read_only=True)
    normalized_score = serializers.FloatField(read_only=True)
    entered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Grade
        fields = [
            'id', 'student', 'student_name',
            'class_subject', 'subject_name',
            'academic_year', 'term', 'grade_type',
            'score', 'max_score', 'weight',
            'percentage', 'excellence_percentage', 'classical_equivalent_percentage', 'normalized_score',
            'date', 'comment',
            'entered_by', 'entered_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_entered_by_name(self, obj):
        return obj.entered_by.get_full_name() if obj.entered_by else None

    def validate(self, data):
        if data.get('score', 0) > data.get('max_score', 20):
            raise serializers.ValidationError('Score cannot exceed max score.')
        return data


class ReportCardSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)

    class Meta:
        model = ReportCard
        fields = [
            'id', 'student', 'student_name',
            'academic_year', 'academic_year_name',
            'term', 'overall_average', 'rank',
            'teacher_comment', 'generated_at', 'data',
        ]
        read_only_fields = ['id', 'generated_at']
