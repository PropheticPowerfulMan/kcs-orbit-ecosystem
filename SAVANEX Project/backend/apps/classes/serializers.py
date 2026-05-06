from rest_framework import serializers
from .models import AcademicYear, Level, Class, Subject, ClassSubject
from .utils import build_class_name, normalize_class_level, normalize_class_suffix


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
    class_level = serializers.CharField(write_only=True, required=False, allow_blank=True)
    suffix = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Class
        fields = [
            'id', 'name', 'level', 'level_name',
            'academic_year', 'academic_year_name',
            'class_teacher', 'class_teacher_name',
            'class_level', 'suffix', 'capacity', 'room', 'student_count',
        ]

    def get_class_teacher_name(self, obj):
        if obj.class_teacher:
            return obj.class_teacher.user.get_full_name()
        return None

    def validate(self, attrs):
        class_level = attrs.pop('class_level', '').strip()
        suffix = attrs.pop('suffix', '').strip()

        if class_level:
            normalized_level = normalize_class_level(class_level)
            normalized_suffix = normalize_class_suffix(suffix)
            attrs['name'] = build_class_name(normalized_level, normalized_suffix)

            level = attrs.get('level')
            if level and level.name != normalized_level:
                raise serializers.ValidationError({
                    'level': 'Le niveau choisi doit correspondre a la classe normalisee.'
                })

        elif suffix:
            raise serializers.ValidationError({
                'suffix': 'Le suffixe ne peut pas etre utilise sans classe de base.'
            })

        return attrs


class ClassDetailSerializer(ClassSerializer):
    subjects = ClassSubjectSerializer(source='class_subjects', many=True, read_only=True)

    class Meta(ClassSerializer.Meta):
        fields = ClassSerializer.Meta.fields + ['subjects']
