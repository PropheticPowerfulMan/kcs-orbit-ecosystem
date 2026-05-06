from uuid import uuid4

from django.db import transaction
from rest_framework import serializers

from apps.integration.orbit import sync_parent, sync_student
from apps.users.models import User
from .models import Student
from apps.users.serializers import UserCreateSerializer, UserListSerializer, UserMeSerializer


def _generate_student_id() -> str:
    return f"STU-{uuid4().hex[:10].upper()}"


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)
    kcs_card_id = serializers.CharField(source='user.kcs_card_id', read_only=True)
    photo_data = serializers.CharField(source='user.photo_data', read_only=True)
    photo_source = serializers.CharField(source='user.photo_source', read_only=True)
    left_fingerprint_data = serializers.CharField(source='user.left_fingerprint_data', read_only=True)
    right_fingerprint_data = serializers.CharField(source='user.right_fingerprint_data', read_only=True)
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()
    parent_kcs_card_id = serializers.SerializerMethodField()
    parent_photo_data = serializers.SerializerMethodField()
    parent_left_fingerprint_data = serializers.SerializerMethodField()
    parent_right_fingerprint_data = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'full_name', 'email', 'avatar',
            'kcs_card_id', 'photo_data', 'photo_source',
            'left_fingerprint_data', 'right_fingerprint_data',
            'has_photo', 'has_biometrics',
            'date_of_birth', 'gender', 'address',
            'current_class', 'class_name',
            'parent', 'parent_name', 'parent_kcs_card_id', 'parent_photo_data',
            'parent_left_fingerprint_data', 'parent_right_fingerprint_data',
            'enrollment_date', 'is_active', 'notes',
        ]
        read_only_fields = ['id', 'enrollment_date']

    def get_parent_name(self, obj):
        if obj.parent:
            return obj.parent.get_full_name()
        return None

    def get_class_name(self, obj):
        if obj.current_class:
            return str(obj.current_class)
        return None

    def get_has_photo(self, obj):
        return bool(obj.user.photo_data or obj.user.avatar)

    def get_has_biometrics(self, obj):
        return bool(obj.user.left_fingerprint_data or obj.user.right_fingerprint_data)

    def get_parent_kcs_card_id(self, obj):
        return obj.parent.kcs_card_id if obj.parent else None

    def get_parent_photo_data(self, obj):
        return obj.parent.photo_data if obj.parent else ''

    def get_parent_left_fingerprint_data(self, obj):
        return obj.parent.left_fingerprint_data if obj.parent else ''

    def get_parent_right_fingerprint_data(self, obj):
        return obj.parent.right_fingerprint_data if obj.parent else ''


class StudentCreateSerializer(serializers.ModelSerializer):
    user = UserCreateSerializer()

    class Meta:
        model = Student
        fields = [
            'user', 'student_id', 'date_of_birth', 'gender',
            'address', 'current_class', 'parent', 'notes',
        ]
        extra_kwargs = {
            'student_id': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        user_data = validated_data.pop('user')
        user_data['role'] = 'student'
        user_serializer = UserCreateSerializer(data=user_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()
        student_id = (validated_data.pop('student_id', '') or '').strip() or _generate_student_id()
        student = Student.objects.create(user=user, student_id=student_id, **validated_data)
        return student


class FamilyParentSerializer(UserCreateSerializer):
    class Meta(UserCreateSerializer.Meta):
        extra_kwargs = {
            **UserCreateSerializer.Meta.extra_kwargs,
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
        }


class FamilyStudentSerializer(serializers.ModelSerializer):
    user = UserCreateSerializer()

    class Meta:
        model = Student
        fields = [
            'user', 'student_id', 'date_of_birth', 'gender',
            'address', 'current_class', 'notes',
        ]
        extra_kwargs = {
            'student_id': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
            'current_class': {'required': False, 'allow_null': True},
        }


class FamilyRegistrationSerializer(serializers.Serializer):
    parent = FamilyParentSerializer()
    students = FamilyStudentSerializer(many=True, allow_empty=False)

    def create(self, validated_data):
        parent_data = validated_data['parent']
        students_data = validated_data['students']

        with transaction.atomic():
            parent_serializer = FamilyParentSerializer(data={**parent_data, 'role': User.ROLE_PARENT})
            parent_serializer.is_valid(raise_exception=True)
            parent = parent_serializer.save()

            created_students = []
            for student_data in students_data:
                user_data = student_data.pop('user')
                user_serializer = UserCreateSerializer(data={**user_data, 'role': User.ROLE_STUDENT})
                user_serializer.is_valid(raise_exception=True)
                student_user = user_serializer.save()

                student_id = (student_data.pop('student_id', '') or '').strip() or _generate_student_id()
                student = Student.objects.create(
                    user=student_user,
                    parent=parent,
                    student_id=student_id,
                    **student_data,
                )
                created_students.append(student)

            def _sync_family() -> None:
                sync_parent(parent)
                for student in created_students:
                    sync_student(student)

            transaction.on_commit(_sync_family)

        return {
            'parent': parent,
            'students': created_students,
        }

    def to_representation(self, instance):
        parent = instance['parent']
        students = instance['students']
        return {
            'parent': UserListSerializer(parent).data,
            'students': StudentSerializer(students, many=True).data,
            'studentCount': len(students),
        }


class StudentDetailSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)
    class_name = serializers.SerializerMethodField()

    def get_class_name(self, obj):
        if obj.current_class:
            return str(obj.current_class)
        return None

    class Meta:
        model = Student
        fields = '__all__'
