from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
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


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT token with user role and basic info embedded."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserMeSerializer(self.user).data
        return data


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'phone', 'avatar', 'kcs_card_id',
                  'photo_data', 'photo_source', 'has_photo',
                  'left_fingerprint_data', 'right_fingerprint_data', 'has_biometrics',
                  'language', 'dark_mode']
        read_only_fields = ['id', 'username', 'role']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_has_photo(self, obj):
        return bool(obj.photo_data or obj.avatar)

    def get_has_biometrics(self, obj):
        return bool(obj.left_fingerprint_data or obj.right_fingerprint_data)


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'password', 'role', 'phone', 'kcs_card_id', 'photo_data',
                  'photo_source', 'left_fingerprint_data', 'right_fingerprint_data',
                  'language']
        extra_kwargs = {
            'username': {'required': False, 'allow_blank': True},
            'role': {'required': False},
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone': {'required': False, 'allow_blank': True},
            'kcs_card_id': {'required': False, 'allow_blank': True},
            'photo_data': {'required': False, 'allow_blank': True},
            'photo_source': {'required': False, 'allow_blank': True},
            'left_fingerprint_data': {'required': False, 'allow_blank': True},
            'right_fingerprint_data': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        password = validated_data.pop('password', '') or f"Kcs@{uuid4().hex[:8]}"
        role = validated_data.get('role', User.ROLE_STUDENT)
        username = (validated_data.get('username') or '').strip()
        if not username:
            prefix = 'par' if role == User.ROLE_PARENT else 'usr'
            validated_data['username'] = _generate_username(prefix)
        card_id = (validated_data.get('kcs_card_id') or '').strip()
        if not card_id:
            validated_data['kcs_card_id'] = _generate_kcs_card_id(role)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'role', 'phone',
            'kcs_card_id', 'photo_data', 'photo_source',
            'left_fingerprint_data', 'right_fingerprint_data',
            'has_photo', 'has_biometrics', 'is_active',
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
