from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from uuid import uuid4

from .models import User


def _generate_username(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


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

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'phone', 'avatar', 'language', 'dark_mode']
        read_only_fields = ['id', 'username', 'role']

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'password', 'role', 'phone', 'language']
        extra_kwargs = {
            'username': {'required': False, 'allow_blank': True},
            'role': {'required': False},
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role', User.ROLE_STUDENT)
        username = (validated_data.get('username') or '').strip()
        if not username:
            prefix = 'par' if role == User.ROLE_PARENT else 'usr'
            validated_data['username'] = _generate_username(prefix)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'phone', 'is_active']

    def get_full_name(self, obj):
        return obj.get_full_name()


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Incorrect current password.')
        return value
