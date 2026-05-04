from rest_framework import serializers
from .models import AcademicYear, Level, Class, Subject, ClassSubject


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_date', 'end_date', 'is_current']


class LevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = ['id', 'name', 'order']


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'description', 'credit_hours', 'coefficient']


class ClassSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = ClassSubject
        fields = ['id', 'class_instance', 'subject', 'subject_name', 'teacher', 'teacher_name']

    def get_teacher_name(self, obj):
        return obj.teacher.user.get_full_name() if obj.teacher else None


class ClassSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='level.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    class_teacher_name = serializers.SerializerMethodField()
    student_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Class
        fields = [
            'id', 'name', 'level', 'level_name',
            'academic_year', 'academic_year_name',
            'class_teacher', 'class_teacher_name',
            'capacity', 'room', 'student_count',
        ]

    def get_class_teacher_name(self, obj):
        if obj.class_teacher:
            return obj.class_teacher.user.get_full_name()
        return None


class ClassDetailSerializer(ClassSerializer):
    subjects = ClassSubjectSerializer(source='class_subjects', many=True, read_only=True)

    class Meta(ClassSerializer.Meta):
        fields = ClassSerializer.Meta.fields + ['subjects']
