from rest_framework import serializers
from .models import Teacher
from apps.users.serializers import UserCreateSerializer, UserMeSerializer


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)

    class Meta:
        model = Teacher
        fields = [
            'id', 'teacher_id', 'full_name', 'email', 'avatar', 'phone',
            'qualification', 'specialization', 'hire_date', 'bio', 'is_active',
        ]
        read_only_fields = ['id']


class TeacherCreateSerializer(serializers.ModelSerializer):
    user = UserCreateSerializer()

    class Meta:
        model = Teacher
        fields = ['user', 'teacher_id', 'qualification', 'specialization', 'hire_date', 'bio']

    def create(self, validated_data):
        user_data = validated_data.pop('user')
        user_data['role'] = 'teacher'
        user_serializer = UserCreateSerializer(data=user_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()
        teacher = Teacher.objects.create(user=user, **validated_data)
        return teacher


class TeacherDetailSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = '__all__'
