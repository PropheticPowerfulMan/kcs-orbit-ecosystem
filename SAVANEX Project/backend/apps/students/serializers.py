from uuid import uuid4
import re
import unicodedata

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from apps.integration.orbit import fetch_shared_directory, orbit_sync_is_enabled, sync_class, sync_parent, sync_student
from apps.communication.services import deliver_parent_communication, deliver_user_communication
from apps.classes.utils import get_or_create_standard_class, normalize_class_level, normalize_class_suffix
from apps.users.models import User
from .models import Student
from apps.users.serializers import generate_temporary_password, UserCreateSerializer, UserListSerializer, UserMeSerializer


def _generate_ecosystem_id(entity_prefix: str) -> str:
    return f"SAV-{entity_prefix}-{uuid4().hex[:8].upper()}"


def _school_email_token(value: str | None) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    return re.sub(r'[^a-z0-9]+', '', ''.join(char for char in normalized if not unicodedata.combining(char)).lower())


def _generate_school_email(first_name: str, middle_name: str, last_name: str) -> str:
    first = _school_email_token(first_name) or 'user'
    middle = _school_email_token(middle_name)
    last = _school_email_token(last_name) or 'kcs'
    bases = [f'{first}.{last}']
    if middle:
        bases.extend([f'{first}.{middle[0]}.{last}', f'{first}.{middle}.{last}'])
    for base in bases:
        candidate = f'{base}@ourkcs.org'
        if not User.objects.filter(email__iexact=candidate).exists():
            return candidate
    sequence = 2
    while sequence < 10000:
        candidate = f'{bases[0]}{sequence}@ourkcs.org'
        if not User.objects.filter(email__iexact=candidate).exists():
            return candidate
        sequence += 1
    return f'{bases[0]}{uuid4().hex[:8]}@ourkcs.org'

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


def _deliver_family_credentials(parent, students):
    lines = []
    parent_password = getattr(parent, '_generated_password', None)
    if parent_password:
        lines.append(f"Parent - identifiant: {parent.username}; code: {parent.access_code or 'non defini'}; mot de passe temporaire: {parent_password}")
    for student in students:
        password = getattr(student.user, '_generated_password', None)
        lines.append(f"{student.full_name} - ID: {student.student_id}; identifiant: {student.user.username}; code: {student.user.access_code or 'non defini'}; mot de passe temporaire: {password or 'deja defini'}")
        if password:
            deliver_user_communication(student.user, 'Vos identifiants SAVANEX', f"Identifiant: {student.user.username}\nCode: {student.user.access_code or 'non defini'}\nMot de passe temporaire: {password}\nChangez ce mot de passe a la premiere connexion.", link='/messages')
    deliver_parent_communication(parent, 'Identifiants de votre famille SAVANEX', 'Voici les acces de votre famille :\n' + '\n'.join(lines) + '\n\nChangez les mots de passe temporaires a la premiere connexion.', link='/messages')


class StudentSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    middle_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_email = serializers.EmailField(write_only=True, required=False, allow_blank=True, allow_null=True)
    class_level = serializers.CharField(write_only=True, required=False, allow_blank=True)
    class_suffix = serializers.CharField(write_only=True, required=False, allow_blank=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)
    kcs_card_id = serializers.CharField(source='user.kcs_card_id', read_only=True)
    access_code = serializers.CharField(source='user.access_code', read_only=True)
    photo_data = serializers.CharField(source='user.photo_data', required=False, allow_blank=True)
    photo_source = serializers.CharField(source='user.photo_source', required=False, allow_blank=True)
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
    parent_address = serializers.SerializerMethodField()
    parent_external_id = serializers.SerializerMethodField()
    parent_kcs_card_id = serializers.SerializerMethodField()
    parent_access_code = serializers.SerializerMethodField()
    parent_photo_data = serializers.SerializerMethodField()
    parent_left_fingerprint_data = serializers.SerializerMethodField()
    parent_right_fingerprint_data = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'user_id', 'student_id', 'full_name', 'email', 'avatar',
            'first_name', 'middle_name', 'last_name', 'user_email',
            'kcs_card_id', 'access_code', 'photo_data', 'photo_source',
            'left_fingerprint_data', 'right_fingerprint_data',
            'has_photo', 'has_biometrics',
            'must_change_password', 'password_generated_by_system',
            'date_of_birth', 'gender',
            'current_class', 'class_name', 'class_level', 'class_suffix',
            'parent', 'parent_name', 'parent_email', 'parent_phone', 'parent_address', 'parent_external_id',
            'parent_kcs_card_id', 'parent_access_code', 'parent_photo_data',
            'parent_left_fingerprint_data', 'parent_right_fingerprint_data',
            'enrollment_date', 'is_active', 'notes',
        ]
        read_only_fields = ['id', 'student_id', 'enrollment_date']

    def validate_user_email(self, value):
        normalized = (value or '').strip().lower()
        if not normalized and self.instance is not None:
            return self.instance.user.email
        if normalized:
            duplicate = User.objects.filter(email__iexact=normalized)
            if self.instance is not None:
                duplicate = duplicate.exclude(pk=self.instance.user_id)
            if duplicate.exists():
                raise serializers.ValidationError('Cette adresse e-mail est déjà attribuée à une autre entité.')
        return normalized
    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        first_name = validated_data.pop('first_name', None)
        middle_name = validated_data.pop('middle_name', None)
        last_name = validated_data.pop('last_name', None)
        user_email = validated_data.pop('user_email', None)
        photo_data = user_data.get('photo_data')
        photo_source = user_data.get('photo_source')
        class_level = validated_data.pop('class_level', None)
        class_suffix = validated_data.pop('class_suffix', None)

        if class_level is not None or class_suffix is not None:
            normalized_level = (class_level or '').strip()
            normalized_suffix = (class_suffix or '').strip()
            if normalized_level:
                instance.current_class = get_or_create_standard_class(normalized_level, normalized_suffix)
            else:
                instance.current_class = None

        for field, value in validated_data.items():
            setattr(instance, field, value)

        user_update_fields = []
        if first_name is not None:
            instance.user.first_name = first_name
            user_update_fields.append('first_name')
        if middle_name is not None:
            instance.user.middle_name = middle_name
            user_update_fields.append('middle_name')
        if last_name is not None:
            instance.user.last_name = last_name
            user_update_fields.append('last_name')
        if user_email is not None:
            instance.user.email = user_email or ''
            user_update_fields.append('email')
        if photo_data is not None:
            instance.user.photo_data = photo_data
            user_update_fields.append('photo_data')
        if photo_source is not None:
            instance.user.photo_source = photo_source
            user_update_fields.append('photo_source')

        if user_update_fields:
            instance.user.save(update_fields=user_update_fields)

        instance.save()
        return instance

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation.update({
            'first_name': instance.user.first_name,
            'middle_name': instance.user.middle_name,
            'last_name': instance.user.last_name,
        })
        return representation

    def get_parent_name(self, obj):
        if obj.parent:
            return obj.parent.get_full_name()
        return None

    def get_parent_email(self, obj):
        return obj.parent.email if obj.parent else ''

    def get_parent_phone(self, obj):
        return obj.parent.phone if obj.parent else ''

    def get_parent_address(self, obj):
        return obj.parent.address if obj.parent else ''

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

    def get_parent_access_code(self, obj):
        return obj.parent.access_code if obj.parent else None

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
            'current_class', 'parent', 'notes',
        ]
        extra_kwargs = {
            'student_id': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        user_data = validated_data.pop('user')
        if not (user_data.get('email') or '').strip():
            user_data['email'] = _generate_school_email(
                user_data.get('first_name', ''),
                user_data.get('middle_name', ''),
                user_data.get('last_name', ''),
            )
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
            'current_class', 'class_level', 'class_suffix', 'notes',
        ]
        extra_kwargs = {
            'student_id': {'required': False, 'allow_blank': True},
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

        parent_by_email = None
        parent_by_phone = None
        if parent_email:
            parent_by_email = User.objects.filter(role=User.ROLE_PARENT, email__iexact=parent_email).first()
        if parent_phone:
            parent_by_phone = User.objects.filter(role=User.ROLE_PARENT, phone=parent_phone).first()

        if parent_by_email and parent_by_phone and parent_by_email.pk != parent_by_phone.pk:
            raise serializers.ValidationError({
                'parent': 'The provided email and phone belong to different parent accounts.'
            })

        parent_conflict = parent_by_email or parent_by_phone
        if parent_conflict:
            attrs['existing_parent'] = parent_conflict

        reusable_student_user_ids = set()
        central_student_emails = set()
        central_savanex_student_ids = set()
        central_directory_available = False
        if orbit_sync_is_enabled():
            try:
                shared_directory = fetch_shared_directory()
                central_directory_available = shared_directory.get('source') == 'orbit'
                for shared_student in shared_directory.get('students', []):
                    email = (shared_student.get('email') or '').strip().lower()
                    if email:
                        central_student_emails.add(email)
                    for external_id in shared_student.get('externalIds', []):
                        if (external_id.get('appSlug') or '').upper() == 'SAVANEX':
                            value = (external_id.get('externalId') or '').strip().lower()
                            if value:
                                central_savanex_student_ids.add(value)
            except Exception:
                central_directory_available = False

        existing_student_emails = []
        for student_email in sorted(seen_student_emails):
            existing_user = User.objects.filter(
                role=User.ROLE_STUDENT,
                email__iexact=student_email,
                is_active=True,
            ).select_related('student_profile').first()
            if existing_user is None:
                continue

            local_student_id = (
                existing_user.student_profile.student_id.strip().lower()
                if hasattr(existing_user, 'student_profile')
                else ''
            )
            is_central_student = (
                student_email in central_student_emails
                or (local_student_id and local_student_id in central_savanex_student_ids)
            )
            if central_directory_available and not is_central_student and hasattr(existing_user, 'student_profile'):
                reusable_student_user_ids.add(existing_user.pk)
            else:
                existing_student_emails.append(student_email)

        if existing_student_emails:
            raise serializers.ValidationError({
                'students': f"Student accounts already exist for: {', '.join(existing_student_emails)}."
            })

        attrs['reusable_student_user_ids'] = reusable_student_user_ids
        return attrs

    def create(self, validated_data):
        parent_data = validated_data['parent']
        students_data = validated_data['students']
        existing_parent = validated_data.get('existing_parent')
        reusable_student_user_ids = validated_data.get('reusable_student_user_ids', set())

        with transaction.atomic():
            if existing_parent is not None:
                parent = existing_parent
                parent_update_fields = []
                for field in ('first_name', 'middle_name', 'last_name', 'email', 'phone', 'address', 'language', 'photo_data', 'photo_source'):
                    if field not in parent_data:
                        continue

                    next_value = parent_data.get(field)
                    if isinstance(next_value, str):
                        next_value = next_value.strip()

                    if getattr(parent, field) != next_value:
                        setattr(parent, field, next_value)
                        parent_update_fields.append(field)

                if parent.role != User.ROLE_PARENT:
                    parent.role = User.ROLE_PARENT
                    parent_update_fields.append('role')
                if not parent.is_active:
                    parent.is_active = True
                    parent_update_fields.append('is_active')

                parent_password = (parent_data.get('password') or '').strip()
                if not parent_password:
                    parent_password = generate_temporary_password(User.ROLE_PARENT)
                    parent.must_change_password = True
                    parent.password_generated_by_system = True
                    parent_update_fields.extend(['must_change_password', 'password_generated_by_system'])
                parent.set_password(parent_password)
                parent._generated_password = parent_password
                parent_update_fields.append('password')
                parent.save(update_fields=list(dict.fromkeys(parent_update_fields)))
            else:
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
                if not (user_data.get('email') or '').strip():
                    user_data['email'] = _generate_school_email(
                        user_data.get('first_name', ''),
                        user_data.get('middle_name', ''),
                        user_data.get('last_name', ''),
                    )
                student_email = (user_data.get('email') or '').strip()
                inactive_user = None
                if student_email:
                    inactive_user = User.objects.filter(
                        role=User.ROLE_STUDENT,
                        email__iexact=student_email,
                    ).filter(
                        Q(is_active=False) | Q(pk__in=reusable_student_user_ids)
                    ).select_related('student_profile').first()

                student_id = (student_data.pop('student_id', '') or '').strip()
                class_level = student_data.pop('class_level', '').strip()
                class_suffix = student_data.pop('class_suffix', '').strip()
                if class_level:
                    student_data['current_class'] = get_or_create_standard_class(class_level, class_suffix)
                elif 'current_class' not in student_data:
                    student_data['current_class'] = None

                if inactive_user is not None and hasattr(inactive_user, 'student_profile'):
                    student_user = inactive_user
                    user_update_fields = []
                    for field in ('first_name', 'middle_name', 'last_name', 'email', 'phone', 'language', 'photo_data', 'photo_source'):
                        if field not in user_data:
                            continue
                        next_value = user_data.get(field)
                        if isinstance(next_value, str):
                            next_value = next_value.strip()
                        if getattr(student_user, field) != next_value:
                            setattr(student_user, field, next_value)
                            user_update_fields.append(field)

                    student_user.is_active = True
                    student_user.role = User.ROLE_STUDENT
                    user_update_fields.extend(['is_active', 'role'])
                    student_password = (user_data.get('password') or '').strip()
                    if not student_password:
                        student_password = generate_temporary_password(User.ROLE_STUDENT)
                        student_user.must_change_password = True
                        student_user.password_generated_by_system = True
                        user_update_fields.extend(['must_change_password', 'password_generated_by_system'])
                    student_user.set_password(student_password)
                    student_user._generated_password = student_password
                    user_update_fields.append('password')
                    student_user.save(update_fields=list(dict.fromkeys(user_update_fields)))

                    student = student_user.student_profile
                    for field, value in student_data.items():
                        setattr(student, field, value)
                    if student_id:
                        student.student_id = student_id
                    student.parent = parent
                    student.is_active = True
                    student.save()
                else:
                    user_serializer = UserCreateSerializer(data={**user_data, 'role': User.ROLE_STUDENT})
                    user_serializer.is_valid(raise_exception=True)
                    student_user = user_serializer.save()
                    student = Student.objects.create(
                        user=student_user,
                        parent=parent,
                        student_id=student_id or _generate_student_id(),
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
                _deliver_family_credentials(parent, created_students)

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
                    'displayName': ' '.join(filter(None, [parent.last_name, parent.middle_name, parent.first_name])),
                    'username': parent.username,
                    'accessCode': parent.access_code,
                    'temporaryPassword': getattr(parent, '_generated_password', None),
                    'mustChangePassword': parent.must_change_password,
                },
                'students': [
                    {
                        'displayName': ' '.join(filter(None, [student.user.last_name, student.user.middle_name, student.user.first_name])),
                        'studentId': student.student_id,
                        'username': student.user.username,
                        'accessCode': student.user.access_code,
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
