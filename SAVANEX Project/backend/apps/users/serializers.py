from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from secrets import randbelow
from uuid import uuid4

from .models import User


def _generate_username(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


def _generate_kcs_card_id(role: str) -> str:
    prefix_map = {
        User.ROLE_PARENT: 'PAR',
        User.ROLE_STUDENT: 'STU',
        User.ROLE_TEACHER: 'TCH',
        User.ROLE_EMPLOYEE: 'EMP',
        User.ROLE_ADMIN: 'ADM',
    }
    prefix = prefix_map.get(role, 'USR')
    return f"KCS-{prefix}-{uuid4().hex[:8].upper()}"


def _generate_access_code(role: str) -> str:
    prefix_map = {
        User.ROLE_PARENT: 'PAR',
        User.ROLE_STUDENT: 'STU',
        User.ROLE_TEACHER: 'TCH',
        User.ROLE_EMPLOYEE: 'EMP',
        User.ROLE_ADMIN: 'ADM',
    }
    prefix = prefix_map.get(role, 'USR')
    return f"ACC-{prefix}-{uuid4().hex[:6].upper()}"


def _generate_unique_access_code(role: str) -> str:
    for _ in range(5):
        access_code = _generate_access_code(role)
        if not User.objects.filter(access_code=access_code).exists():
            return access_code
    return _generate_access_code(role)


def generate_temporary_password(role: str) -> str:
    return f"KCS-{randbelow(1_000_000):06d}"


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT token with user role and basic info embedded."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        token['must_change_password'] = user.must_change_password
        token['access_code'] = user.access_code
        return token

    def validate(self, attrs):
        identifier = (attrs.get('username') or '').strip()
        password = attrs.get('password') or ''

        self.user = User.objects.filter(
            Q(username__iexact=identifier)
            | Q(email__iexact=identifier)
            | Q(access_code__iexact=identifier)
        ).first()

        if self.user is None or not self.user.check_password(password) or not self.user.is_active:
            raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')

        refresh = self.get_token(self.user)
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
        data['user'] = UserMeSerializer(self.user).data
        data['must_change_password'] = self.user.must_change_password
        return data


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'phone', 'avatar', 'kcs_card_id', 'access_code',
                  'photo_data', 'photo_source', 'has_photo',
                  'left_fingerprint_data', 'right_fingerprint_data', 'has_biometrics',
                  'language', 'dark_mode', 'must_change_password',
                  'password_generated_by_system']
        read_only_fields = ['id', 'username', 'role']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_has_photo(self, obj):
        return bool(obj.photo_data or obj.avatar)

    def get_has_biometrics(self, obj):
        return bool(obj.left_fingerprint_data or obj.right_fingerprint_data)


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)
    generated_password = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'password', 'role', 'phone', 'kcs_card_id', 'access_code', 'photo_data',
                  'photo_source', 'left_fingerprint_data', 'right_fingerprint_data',
                  'language', 'must_change_password', 'password_generated_by_system',
                  'generated_password']
        extra_kwargs = {
            'username': {'required': False, 'allow_blank': True},
            'role': {'required': False},
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone': {'required': False, 'allow_blank': True},
            'kcs_card_id': {'required': False, 'allow_blank': True},
            'access_code': {'required': False, 'allow_blank': True},
            'photo_data': {'required': False, 'allow_blank': True},
            'photo_source': {'required': False, 'allow_blank': True},
            'left_fingerprint_data': {'required': False, 'allow_blank': True},
            'right_fingerprint_data': {'required': False, 'allow_blank': True},
            'must_change_password': {'required': False},
            'password_generated_by_system': {'required': False},
        }

    def get_generated_password(self, obj):
        return getattr(obj, '_generated_password', None)

    def create(self, validated_data):
        role = validated_data.get('role', User.ROLE_STUDENT)
        password = (validated_data.pop('password', '') or '').strip()
        generated_by_system = not password
        if generated_by_system:
            password = generate_temporary_password(role)
            validated_data['must_change_password'] = True
            validated_data['password_generated_by_system'] = True
        username = (validated_data.get('username') or '').strip()
        if not username:
            prefix = 'par' if role == User.ROLE_PARENT else 'usr'
            validated_data['username'] = _generate_username(prefix)
        card_id = (validated_data.get('kcs_card_id') or '').strip()
        if not card_id:
            validated_data['kcs_card_id'] = _generate_kcs_card_id(role)
        access_code = (validated_data.get('access_code') or '').strip()
        if not access_code:
            validated_data['access_code'] = _generate_unique_access_code(role)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if generated_by_system:
            user._generated_password = password
        return user


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'role', 'phone',
            'kcs_card_id', 'access_code', 'photo_data', 'photo_source',
            'left_fingerprint_data', 'right_fingerprint_data',
            'has_photo', 'has_biometrics', 'is_active',
            'must_change_password', 'password_generated_by_system',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_has_photo(self, obj):
        return bool(obj.photo_data or obj.avatar)

    def get_has_biometrics(self, obj):
        return bool(obj.left_fingerprint_data or obj.right_fingerprint_data)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Incorrect current password.')
        return value
