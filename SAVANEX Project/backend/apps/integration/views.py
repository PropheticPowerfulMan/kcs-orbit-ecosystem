from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.users.models import User
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
