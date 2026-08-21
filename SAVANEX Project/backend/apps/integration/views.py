from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.db.models import Q

from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.users.models import User
from apps.users.serializers import UserMeSerializer
from apps.users.views import provision_student_access_identity, reset_user_access_credentials
from apps.users.permissions import IsAdminUser
from .orbit import create_registry_entity, delete_registry_entity, fetch_shared_directory, orbit_sync_is_enabled, update_registry_entity


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_directory_view(_request):
    if orbit_sync_is_enabled():
        return Response(fetch_shared_directory())

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
        Q(username__iexact=identifier) | Q(email__iexact=identifier) | Q(access_code__iexact=identifier)
    ).first()
    if user is None or not user.is_active or not user.check_password(password):
        return Response({'detail': 'Invalid credentials.'}, status=401)

    if user.role not in {User.ROLE_PARENT, User.ROLE_TEACHER, User.ROLE_EMPLOYEE, User.ROLE_STUDENT}:
        return Response({'detail': 'Identity is not federated.'}, status=403)

    return Response({'user': UserMeSerializer(user).data})


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
    return Response(reset_user_access_credentials(user))
