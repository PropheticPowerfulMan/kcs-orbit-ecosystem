from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.utils import timezone
from django.db.models import Q

from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.teachers.serializers import TeacherSerializer, TeacherCreateSerializer
from apps.teachers.views import finalize_teacher_creation
from apps.teachers.services import deactivate_teacher
from apps.integration.orbit import sync_teacher
from apps.users.models import User
from apps.users.serializers import UserMeSerializer
from apps.users.views import provision_parent_access_identity, provision_student_access_identity, reset_user_access_credentials
from apps.users.permissions import IsAdminUser
from .orbit import create_registry_entity, delete_registry_entity, fetch_shared_directory, orbit_sync_is_enabled, update_registry_entity




def _trusted_nexus(request):
    key=request.headers.get('x-api-key','')
    return bool(key and key==settings.KCS_NEXUS_AUTH_KEY)

@api_view(['GET','POST'])
@permission_classes([AllowAny])
def ecosystem_employees_view(request):
    if not _trusted_nexus(request):return Response({'detail':'Unauthorized.'},status=401)
    if request.method=='GET':
        rows=Teacher.objects.select_related('user').filter(is_active=True).order_by('user__last_name','user__first_name')
        return Response(TeacherSerializer(rows,many=True).data)
    serializer=TeacherCreateSerializer(data=request.data);serializer.is_valid(raise_exception=True)
    teacher=serializer.save();delivery=finalize_teacher_creation(teacher)
    data=serializer.to_representation(teacher);data.update(credentialDelivery=[item.__dict__ for item in delivery])
    return Response(data,status=201)

@api_view(['GET','PATCH','DELETE'])
@permission_classes([AllowAny])
def ecosystem_employee_detail_view(request,pk):
    if not _trusted_nexus(request):return Response({'detail':'Unauthorized.'},status=401)
    try:teacher=Teacher.objects.select_related('user').get(pk=pk)
    except Teacher.DoesNotExist:return Response({'detail':'Employee not found.'},status=404)
    if request.method=='GET':return Response(TeacherSerializer(teacher).data)
    if request.method=='DELETE':deactivate_teacher(teacher);return Response({'detail':'Employee deactivated.'})
    serializer=TeacherSerializer(teacher,data=request.data,partial=True);serializer.is_valid(raise_exception=True)
    teacher=serializer.save();sync_teacher(teacher);return Response(TeacherSerializer(teacher).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_directory_view(_request):
    if orbit_sync_is_enabled():
        cache_key = 'savanex:shared-directory:v1'
        directory = cache.get(cache_key)
        if directory is None:
            directory = fetch_shared_directory()
            cache.set(cache_key, directory, timeout=30)
        return Response(directory)

    students = Student.objects.select_related('user', 'parent', 'current_class').filter(is_active=True)
    teachers = Teacher.objects.select_related('user').filter(is_active=True)
    parents = User.objects.filter(role=User.ROLE_PARENT, is_active=True).order_by('last_name', 'first_name')

    return Response({
        'source': 'local',
        'visibility': 'shared-directory',
        'counts': {
            'families': parents.count(),
            'parents': parents.count(),
            'students': students.count(),
            'teachers': teachers.count(),
        },
        'families': [
            {
                'id': str(parent.pk),
                'displayId': parent.username,
                'familyLabel': f"{parent.last_name or parent.get_full_name() or parent.username} Family",
                'parentIds': [str(parent.pk)],
                'studentIds': [str(student.pk) for student in parent.children.filter(is_active=True)],
                'organizationId': None,
                'externalIds': [],
            }
            for parent in parents
        ],
        'parents': [
            {
                'id': str(parent.pk),
                'displayId': parent.username,
                'fullName': parent.get_full_name() or parent.username,
                'firstName': parent.first_name,
                'middleName': parent.middle_name or None,
                'lastName': parent.last_name,
                'organizationId': None,
                'studentIds': [str(student.pk) for student in parent.children.filter(is_active=True)],
                'externalIds': [],
            }
            for parent in parents
        ],
        'students': [
            {
                'id': str(student.pk),
                'displayId': student.student_id,
                'fullName': student.full_name,
                'firstName': student.user.first_name,
                'middleName': student.user.middle_name or None,
                'lastName': student.user.last_name,
                'classId': str(student.current_class_id) if student.current_class_id else None,
                'parentId': str(student.parent_id) if student.parent_id else None,
                'organizationId': None,
                'externalIds': [],
            }
            for student in students
        ],
        'teachers': [
            {
                'id': str(teacher.pk),
                'fullName': teacher.full_name,
                'firstName': teacher.user.first_name,
                'middleName': teacher.user.middle_name or None,
                'lastName': teacher.user.last_name,
                'organizationId': None,
                'externalIds': [],
            }
            for teacher in teachers
        ],
    })


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_shared_entity_view(request, entity_type):
    if not orbit_sync_is_enabled():
        return Response({'message': 'Orbit registry mode must be enabled to create shared entities from SAVANEX.'}, status=409)

    return Response(create_registry_entity(entity_type, request.data), status=201)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def shared_entity_detail_view(request, entity_type, identifier):
    if not orbit_sync_is_enabled():
        return Response({'message': 'Orbit registry mode must be enabled to manage shared entities from SAVANEX.'}, status=409)

    identifier_type = request.query_params.get('identifierType', 'orbitId')
    if request.method == 'DELETE':
        return Response(delete_registry_entity(entity_type, identifier, identifier_type))

    return Response(update_registry_entity(entity_type, identifier, request.data, identifier_type))

@api_view(['POST'])
@permission_classes([AllowAny])
def authenticate_ecosystem_identity_view(request):
    provided_key = request.headers.get('x-api-key', '')
    trusted_keys = {settings.KCS_NEXUS_AUTH_KEY, settings.EDUPAY_AUTH_KEY, settings.EDUSYNC_AUTH_KEY} - {''}
    if not provided_key or provided_key not in trusted_keys:
        return Response({'detail': 'Unauthorized ecosystem authentication request.'}, status=401)

    identifier = str(request.data.get('identifier') or request.data.get('username') or '').strip()
    password = str(request.data.get('password') or '')
    user = User.objects.filter(
        Q(username__iexact=identifier)
        | Q(email__iexact=identifier)
        | Q(access_code__iexact=identifier)
        | Q(kcs_card_id__iexact=identifier)
        | Q(teacher_profile__employee_id__iexact=identifier)
        | Q(teacher_profile__teacher_id__iexact=identifier)
        | Q(teacher_profile__work_email__iexact=identifier)
        | Q(teacher_profile__personal_email__iexact=identifier)
    ).distinct().first()
    if user is None or not user.is_active or not user.check_password(password):
        return Response({'detail': 'Invalid credentials.'}, status=401)

    if user.role not in {User.ROLE_PARENT, User.ROLE_TEACHER, User.ROLE_EMPLOYEE, User.ROLE_STUDENT}:
        return Response({'detail': 'Identity is not federated.'}, status=403)

    return Response({'user': UserMeSerializer(user).data})


@api_view(['POST'])
@permission_classes([AllowAny])
def change_ecosystem_identity_password_view(request, entity_type, identifier):
    provided_key = request.headers.get('x-api-key', '')
    trusted_keys = {settings.KCS_NEXUS_AUTH_KEY, settings.EDUPAY_AUTH_KEY, settings.EDUSYNC_AUTH_KEY} - {''}
    if not provided_key or provided_key not in trusted_keys:
        return Response({'detail': 'Unauthorized ecosystem password change request.'}, status=401)

    current_password = str(request.data.get('currentPassword') or '')
    new_password = str(request.data.get('newPassword') or '')
    if len(new_password) < 8:
        return Response({'detail': 'Le nouveau mot de passe doit contenir au moins 8 caracteres.'}, status=400)

    query = Q(username__iexact=identifier) | Q(kcs_card_id__iexact=identifier) | Q(access_code__iexact=identifier) | Q(email__iexact=identifier)
    allowed_roles = {
        'parent': {User.ROLE_PARENT},
        'student': {User.ROLE_STUDENT},
        'teacher': {User.ROLE_TEACHER, User.ROLE_EMPLOYEE},
        'employee': {User.ROLE_TEACHER, User.ROLE_EMPLOYEE},
    }.get(entity_type)
    if not allowed_roles:
        return Response({'detail': 'Unsupported entity type.'}, status=400)

    user = User.objects.filter(role__in=allowed_roles, is_active=True).filter(query).first()
    if not user:
        return Response({'detail': 'Compte SAVANEX introuvable pour cette entite.'}, status=404)
    if not user.check_password(current_password):
        return Response({'detail': 'Mot de passe actuel incorrect.'}, status=400)

    user.set_password(new_password)
    user.must_change_password = False
    user.password_generated_by_system = False
    user.save(update_fields=['password', 'must_change_password', 'password_generated_by_system', 'updated_at'])
    return Response({'detail': 'Mot de passe modifie dans l ecosystem.', 'accessCode': user.access_code})

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_ecosystem_identity_access_view(request, entity_type, identifier):
    provided_key = request.headers.get('x-api-key', '')
    trusted_keys = {settings.KCS_NEXUS_AUTH_KEY, settings.EDUPAY_AUTH_KEY, settings.EDUSYNC_AUTH_KEY} - {''}
    if not provided_key or provided_key not in trusted_keys:
        return Response({'detail': 'Unauthorized ecosystem reset request.'}, status=401)

    if entity_type == 'parent':
        user = User.objects.filter(role=User.ROLE_PARENT, is_active=True).filter(
            Q(username__iexact=identifier) | Q(kcs_card_id__iexact=identifier)
            | Q(access_code__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if not user:
            email = str(request.data.get('email') or '').strip()
            phone = str(request.data.get('phone') or '').strip()
            contact_filter = Q()
            if email:
                contact_filter |= Q(email__iexact=email)
            if phone:
                contact_filter |= Q(phone=phone)
            if contact_filter:
                user = User.objects.filter(role=User.ROLE_PARENT, is_active=True).filter(contact_filter).first()
        if not user:
            user = provision_parent_access_identity(identifier, request.data)
    elif entity_type == 'student':
        student = Student.objects.select_related('user').filter(is_active=True).filter(
            Q(student_id__iexact=identifier) | Q(user__username__iexact=identifier)
            | Q(user__kcs_card_id__iexact=identifier) | Q(user__access_code__iexact=identifier)
            | Q(user__email__iexact=identifier)
        ).first()
        user = student.user if student else None
        if not user:
            user = provision_student_access_identity(identifier, request.data)
    elif entity_type in ('employee', 'teacher'):
        teacher = Teacher.objects.select_related('user').filter(is_active=True).filter(
            Q(teacher_id__iexact=identifier) | Q(user__username__iexact=identifier)
            | Q(user__kcs_card_id__iexact=identifier) | Q(user__access_code__iexact=identifier)
            | Q(user__email__iexact=identifier)
        ).first()
        user = teacher.user if teacher else None
    else:
        return Response({'detail': 'Unsupported entity type.'}, status=400)

    if not user:
        return Response({'detail': 'Compte SAVANEX introuvable pour cette entite.'}, status=404)
    return Response(reset_user_access_credentials(user, defer_side_effects=True))

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def document_verification_issue_view(request):
    entity_type = str(request.data.get('entity_type', '')).strip().lower()
    reference = str(request.data.get('reference', '')).strip()
    full_name = str(request.data.get('full_name', '')).strip()
    if entity_type not in {'student', 'parent', 'employee'} or not reference or not full_name:
        return Response({'detail': 'Données du document invalides.'}, status=400)
    payload = {
        'entity_type': entity_type,
        'reference': reference[:120],
        'full_name': full_name[:180],
        'issued_at': timezone.now().isoformat(),
    }
    token = signing.dumps(payload, salt='savanex.entity-document.v1', compress=True)
    url = request.build_absolute_uri(f'/api/integration/document-verification/{token}/')
    return Response({'verification_url': url, 'document_reference': reference, 'issued_at': payload['issued_at']})


@api_view(['GET'])
@permission_classes([AllowAny])
def document_verification_view(_request, token):
    try:
        payload = signing.loads(token, salt='savanex.entity-document.v1')
    except signing.BadSignature:
        return Response({'valid': False, 'detail': 'Document SAVANEX non authentique.'}, status=400)
    return Response({
        'valid': True,
        'institution': 'Kinshasa Christian School',
        'system': 'SAVANEX',
        'entity_type': payload.get('entity_type'),
        'reference': payload.get('reference'),
        'full_name': payload.get('full_name'),
        'issued_at': payload.get('issued_at'),
    })