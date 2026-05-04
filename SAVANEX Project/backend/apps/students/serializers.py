from rest_framework import serializers
from .models import Student
from apps.users.serializers import UserCreateSerializer, UserMeSerializer


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)
    class_name = serializers.CharField(source='current_class.__str__', read_only=True)
    parent_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'full_name', 'email', 'avatar',
            'date_of_birth', 'gender', 'address',
            'current_class', 'class_name',
            'parent', 'parent_name',
            'enrollment_date', 'is_active', 'notes',
        ]
        read_only_fields = ['id', 'enrollment_date']

    def get_parent_name(self, obj):
        if obj.parent:
            return obj.parent.get_full_name()
        return None


class StudentCreateSerializer(serializers.ModelSerializer):
    user = UserCreateSerializer()

    class Meta:
        model = Student
        fields = [
            'user', 'student_id', 'date_of_birth', 'gender',
            'address', 'current_class', 'parent', 'notes',
        ]

    def create(self, validated_data):
        user_data = validated_data.pop('user')
        user_data['role'] = 'student'
        user_serializer = UserCreateSerializer(data=user_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()
        student = Student.objects.create(user=user, **validated_data)
        return student


class StudentDetailSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)
    class_name = serializers.CharField(source='current_class.__str__', read_only=True)

    class Meta:
        model = Student
        fields = '__all__'
