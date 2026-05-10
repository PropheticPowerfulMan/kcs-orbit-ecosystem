from rest_framework import serializers
from .models import Teacher
from .services import apply_teacher_status
from apps.users.serializers import UserCreateSerializer, UserMeSerializer


def _generate_employee_id() -> str:
    for _ in range(5):
        employee_id = Teacher._meta.get_field('employee_id').default()
        if not Teacher.objects.filter(employee_id=employee_id).exists() and not Teacher.objects.filter(teacher_id=employee_id).exists():
            return employee_id
    return Teacher._meta.get_field('employee_id').default()


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)
    contact_phone = serializers.CharField(source='user.phone', read_only=True)
    kcs_card_id = serializers.CharField(source='user.kcs_card_id', read_only=True)
    access_code = serializers.CharField(source='user.access_code', read_only=True)
    photo_data = serializers.CharField(source='user.photo_data', read_only=True)
    photo_source = serializers.CharField(source='user.photo_source', read_only=True)
    left_fingerprint_data = serializers.CharField(source='user.left_fingerprint_data', read_only=True)
    right_fingerprint_data = serializers.CharField(source='user.right_fingerprint_data', read_only=True)
    has_photo = serializers.SerializerMethodField()
    has_biometrics = serializers.SerializerMethodField()
    must_change_password = serializers.BooleanField(source='user.must_change_password', read_only=True)
    password_generated_by_system = serializers.BooleanField(source='user.password_generated_by_system', read_only=True)
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
            'emergency_contact_phone', 'full_name', 'email', 'first_name', 'last_name',
            'user_email', 'phone', 'avatar', 'contact_phone',
            'kcs_card_id', 'access_code', 'photo_data', 'photo_source',
            'left_fingerprint_data', 'right_fingerprint_data',
            'has_photo', 'has_biometrics',
            'must_change_password', 'password_generated_by_system',
            'qualification', 'specialization', 'hire_date', 'end_date', 'bio',
            'employment_notes', 'is_active',
        ]
        read_only_fields = ['id']

    def update(self, instance, validated_data):
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        user_email = validated_data.pop('user_email', None)
        phone = validated_data.pop('phone', None)

        has_is_active = 'is_active' in validated_data
        has_employment_status = 'employment_status' in validated_data

        if has_is_active and not has_employment_status:
            apply_teacher_status(instance, is_active=validated_data['is_active'])
            validated_data['employment_status'] = instance.employment_status
        elif has_employment_status and not has_is_active:
            apply_teacher_status(instance, is_active=validated_data['employment_status'] != Teacher.STATUS_INACTIVE)
            validated_data['is_active'] = instance.is_active

        for field, value in validated_data.items():
            setattr(instance, field, value)

        user_update_fields = []
        if first_name is not None:
            instance.user.first_name = first_name
            user_update_fields.append('first_name')
        if last_name is not None:
            instance.user.last_name = last_name
            user_update_fields.append('last_name')
        if user_email is not None:
            instance.user.email = user_email
            user_update_fields.append('email')
        if phone is not None:
            instance.user.phone = phone
            user_update_fields.append('phone')

        if has_is_active or has_employment_status:
            user_update_fields.append('is_active')

        if user_update_fields:
            instance.user.save(update_fields=list(dict.fromkeys(user_update_fields)))

        instance.save()
        return instance

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
            'teacher_id': {'required': False, 'allow_blank': True},
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
        employee_id = (validated_data.get('employee_id') or '').strip()
        teacher_id = (validated_data.get('teacher_id') or '').strip()
        if not employee_id and not teacher_id:
            employee_id = _generate_employee_id()
            teacher_id = employee_id
        elif employee_id and not teacher_id:
            teacher_id = employee_id
        elif teacher_id and not employee_id:
            employee_id = teacher_id

        validated_data['employee_id'] = employee_id
        validated_data['teacher_id'] = teacher_id
        teacher = Teacher.objects.create(user=user, **validated_data)
        return teacher

    def to_representation(self, instance):
        return {
            **TeacherSerializer(instance).data,
            'temporaryCredentials': {
                'username': instance.user.username,
                'accessCode': instance.user.access_code,
                'temporaryPassword': getattr(instance.user, '_generated_password', None),
                'mustChangePassword': instance.user.must_change_password,
            },
        }


class TeacherDetailSerializer(serializers.ModelSerializer):
    user = UserMeSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = '__all__'
