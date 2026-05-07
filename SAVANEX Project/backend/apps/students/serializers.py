from uuid import uuid4

from django.db import transaction
from rest_framework import serializers

from apps.integration.orbit import sync_class, sync_parent, sync_student
from apps.classes.utils import get_or_create_standard_class, normalize_class_level, normalize_class_suffix
from apps.users.models import User
from .models import Student
from apps.users.serializers import UserCreateSerializer, UserListSerializer, UserMeSerializer


def _generate_ecosystem_id(entity_prefix: str) -> str:
    return f"SAV-{entity_prefix}-{uuid4().hex[:8].upper()}"


def _generate_student_id() -> str:
    for _ in range(5):
        student_id = _generate_ecosystem_id("STU")
        if not Student.objects.filter(student_id=student_id).exists():
            return student_id
    return _generate_ecosystem_id("STU")


def _generate_parent_external_id() -> str:
    for _ in range(5):
        parent_id = _generate_ecosystem_id("PAR")
        if not User.objects.filter(username=parent_id).exists():
            return parent_id
    return _generate_ecosystem_id("PAR")


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
    must_change_password = serializers.BooleanField(source='user.must_change_password', read_only=True)
    password_generated_by_system = serializers.BooleanField(source='user.password_generated_by_system', read_only=True)
    class_name = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()
    parent_email = serializers.SerializerMethodField()
    parent_phone = serializers.SerializerMethodField()
    parent_external_id = serializers.SerializerMethodField()
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
            'must_change_password', 'password_generated_by_system',
            'date_of_birth', 'gender', 'address',
            'current_class', 'class_name',
            'parent', 'parent_name', 'parent_email', 'parent_phone', 'parent_external_id',
            'parent_kcs_card_id', 'parent_photo_data',
            'parent_left_fingerprint_data', 'parent_right_fingerprint_data',
            'enrollment_date', 'is_active', 'notes',
        ]
        read_only_fields = ['id', 'enrollment_date']

    def get_parent_name(self, obj):
        if obj.parent:
            return obj.parent.get_full_name()
        return None

    def get_parent_email(self, obj):
        return obj.parent.email if obj.parent else ''

    def get_parent_phone(self, obj):
        return obj.parent.phone if obj.parent else ''

    def get_parent_external_id(self, obj):
        return obj.parent.username if obj.parent else ''

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
    class_level = serializers.CharField(required=False, allow_blank=True, write_only=True)
    class_suffix = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Student
        fields = [
            'user', 'student_id', 'date_of_birth', 'gender',
            'address', 'current_class', 'class_level', 'class_suffix', 'notes',
        ]
        extra_kwargs = {
            'student_id': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
            'current_class': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        class_level = attrs.get('class_level', '').strip()
        class_suffix = attrs.get('class_suffix', '').strip()

        if attrs.get('current_class') and (class_level or class_suffix):
            raise serializers.ValidationError({
                'current_class': 'Utilisez soit une classe existante, soit la classe normalisee et son suffixe.'
            })

        if class_level:
            try:
                normalize_class_level(class_level)
                normalize_class_suffix(class_suffix)
            except ValueError as error:
                raise serializers.ValidationError({'class_level': str(error)})
        elif class_suffix:
            raise serializers.ValidationError({
                'class_suffix': 'Le suffixe est optionnel, mais il doit accompagner une classe de base.'
            })

        return attrs


class FamilyRegistrationSerializer(serializers.Serializer):
    parent = FamilyParentSerializer()
    students = FamilyStudentSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        parent_data = attrs['parent']
        students_data = attrs['students']

        parent_email = (parent_data.get('email') or '').strip().lower()
        parent_phone = (parent_data.get('phone') or '').strip()

        duplicate_student_emails = set()
        seen_student_emails = set()

        for student_data in students_data:
            email = (student_data.get('user', {}).get('email') or '').strip().lower()
            if not email:
                continue
            if email in seen_student_emails:
                duplicate_student_emails.add(email)
            seen_student_emails.add(email)

        if duplicate_student_emails:
            raise serializers.ValidationError({
                'students': f"Duplicate student emails in request: {', '.join(sorted(duplicate_student_emails))}."
            })

        parent_conflict = None
        if parent_email:
            parent_conflict = User.objects.filter(role=User.ROLE_PARENT, email__iexact=parent_email).first()
        if not parent_conflict and parent_phone:
            parent_conflict = User.objects.filter(role=User.ROLE_PARENT, phone=parent_phone).first()

        if parent_conflict:
            raise serializers.ValidationError({
                'parent': 'A parent with the same email or phone already exists.'
            })

        existing_student_emails = []
        for student_email in sorted(seen_student_emails):
            if User.objects.filter(role=User.ROLE_STUDENT, email__iexact=student_email).exists():
                existing_student_emails.append(student_email)

        if existing_student_emails:
            raise serializers.ValidationError({
                'students': f"Student accounts already exist for: {', '.join(existing_student_emails)}."
            })

        return attrs

    def create(self, validated_data):
        parent_data = validated_data['parent']
        students_data = validated_data['students']

        with transaction.atomic():
            parent_serializer = FamilyParentSerializer(data={
                **parent_data,
                'role': User.ROLE_PARENT,
                'username': parent_data.get('username') or _generate_parent_external_id(),
            })
            parent_serializer.is_valid(raise_exception=True)
            parent = parent_serializer.save()

            created_students = []
            for student_data in students_data:
                user_data = student_data.pop('user')
                user_serializer = UserCreateSerializer(data={**user_data, 'role': User.ROLE_STUDENT})
                user_serializer.is_valid(raise_exception=True)
                student_user = user_serializer.save()

                student_id = (student_data.pop('student_id', '') or '').strip() or _generate_student_id()
                class_level = student_data.pop('class_level', '').strip()
                class_suffix = student_data.pop('class_suffix', '').strip()
                if class_level:
                    student_data['current_class'] = get_or_create_standard_class(class_level, class_suffix)

                student = Student.objects.create(
                    user=student_user,
                    parent=parent,
                    student_id=student_id,
                    **student_data,
                )
                created_students.append(student)

            def _sync_family() -> None:
                sync_parent(parent)
                synced_class_ids = set()
                for student in created_students:
                    if student.current_class_id and student.current_class_id not in synced_class_ids:
                        sync_class(student.current_class)
                        synced_class_ids.add(student.current_class_id)
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
            'temporaryCredentials': {
                'parent': {
                    'username': parent.username,
                    'temporaryPassword': getattr(parent, '_generated_password', None),
                    'mustChangePassword': parent.must_change_password,
                },
                'students': [
                    {
                        'studentId': student.student_id,
                        'username': student.user.username,
                        'temporaryPassword': getattr(student.user, '_generated_password', None),
                        'mustChangePassword': student.user.must_change_password,
                    }
                    for student in students
                ],
            },
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
