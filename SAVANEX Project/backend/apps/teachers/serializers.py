from rest_framework import serializers
from .models import Teacher
from apps.users.serializers import UserCreateSerializer, UserMeSerializer


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    kcs_card_id = serializers.CharField(source='user.kcs_card_id', read_only=True)
    photo_data = serializers.CharField(source='user.photo_data', read_only=True)
    photo_source = serializers.CharField(source='user.photo_source', read_only=True)
    left_fingerprint_data = serializers.CharField(source='user.left_fingerprint_data', read_only=True)
    right_fingerprint_data = serializers.CharField(source='user.right_fingerprint_data', read_only=True)
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()
    employee_label = serializers.CharField(read_only=True)

    class Meta:
        model = Teacher
        fields = [
            'id', 'teacher_id', 'employee_id', 'employee_type', 'employee_label',
            'department', 'job_title', 'contract_type', 'employment_status',
            'work_location', 'work_email', 'office_phone_extension',
            'payroll_reference', 'national_id_number', 'social_security_number',
            'tax_number', 'bank_name', 'bank_account_number', 'salary_grade',
            'base_salary', 'pay_frequency', 'supervisor_name', 'emergency_contact_name',
            'emergency_contact_phone', 'full_name', 'email', 'avatar', 'phone',
            'kcs_card_id', 'photo_data', 'photo_source',
            'left_fingerprint_data', 'right_fingerprint_data',
            'has_photo', 'has_biometrics',
            'qualification', 'specialization', 'hire_date', 'end_date', 'bio',
            'employment_notes', 'is_active',
        ]
        read_only_fields = ['id']

    def get_has_photo(self, obj):
        return bool(obj.user.photo_data or obj.user.avatar)

    def get_has_biometrics(self, obj):
        return bool(obj.user.left_fingerprint_data or obj.user.right_fingerprint_data)


class TeacherCreateSerializer(serializers.ModelSerializer):
    user = UserCreateSerializer()

    class Meta:
        model = Teacher
        fields = [
            'user', 'teacher_id', 'employee_id', 'employee_type', 'department',
            'job_title', 'qualification', 'specialization', 'hire_date', 'end_date',
            'contract_type', 'employment_status', 'work_location', 'work_email',
            'office_phone_extension', 'payroll_reference', 'national_id_number',
            'social_security_number', 'tax_number', 'bank_name', 'bank_account_number',
            'salary_grade', 'base_salary', 'pay_frequency', 'supervisor_name',
            'emergency_contact_name', 'emergency_contact_phone', 'bio', 'employment_notes',
        ]
        extra_kwargs = {
            'employee_id': {'required': False, 'allow_blank': True},
            'employee_type': {'required': False},
            'department': {'required': False, 'allow_blank': True},
            'job_title': {'required': False, 'allow_blank': True},
            'qualification': {'required': False, 'allow_blank': True},
            'specialization': {'required': False, 'allow_blank': True},
            'end_date': {'required': False, 'allow_null': True},
            'contract_type': {'required': False, 'allow_blank': True},
            'employment_status': {'required': False},
            'work_location': {'required': False, 'allow_blank': True},
            'work_email': {'required': False, 'allow_blank': True},
            'office_phone_extension': {'required': False, 'allow_blank': True},
            'payroll_reference': {'required': False, 'allow_blank': True},
            'national_id_number': {'required': False, 'allow_blank': True},
            'social_security_number': {'required': False, 'allow_blank': True},
            'tax_number': {'required': False, 'allow_blank': True},
            'bank_name': {'required': False, 'allow_blank': True},
            'bank_account_number': {'required': False, 'allow_blank': True},
            'salary_grade': {'required': False, 'allow_blank': True},
            'base_salary': {'required': False, 'allow_null': True},
            'pay_frequency': {'required': False, 'allow_blank': True},
            'supervisor_name': {'required': False, 'allow_blank': True},
            'emergency_contact_name': {'required': False, 'allow_blank': True},
            'emergency_contact_phone': {'required': False, 'allow_blank': True},
            'bio': {'required': False, 'allow_blank': True},
            'employment_notes': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        user_data = validated_data.pop('user')
        employee_type = validated_data.get('employee_type', Teacher.EMPLOYEE_TYPE_TEACHER)
        user_data['role'] = 'teacher' if employee_type == Teacher.EMPLOYEE_TYPE_TEACHER else 'employee'
        user_serializer = UserCreateSerializer(data=user_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()
        validated_data.setdefault('employee_type', Teacher.EMPLOYEE_TYPE_TEACHER)
        if not (validated_data.get('employee_id') or '').strip():
            validated_data.pop('employee_id', None)
        teacher = Teacher.objects.create(user=user, **validated_data)
        return teacher


class TeacherDetailSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = '__all__'
