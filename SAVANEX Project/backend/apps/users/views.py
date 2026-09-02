from concurrent.futures import ThreadPoolExecutor
import logging

from django.db import close_old_connections, transaction
from django.db.models import Q
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from apps.integration.orbit import delete_parent, delete_student, sync_parent, sync_student, sync_teacher
from apps.communication.services import _send_user_sms, deliver_direct_parent_contact, deliver_employee_communication, send_branded_email
from apps.teachers.services import deactivate_teacher
from .models import InstitutionalEmailAudit, User
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserMeSerializer,
    UserCreateSerializer,
    UserListSerializer,
    PasswordChangeSerializer,
    generate_temporary_password,
)
from .permissions import IsAdminUser


PASSWORD_RESET_RESPONSE = {'detail': 'If an account exists, a new temporary password will be sent through the selected channel.'}

logger = logging.getLogger(__name__)
_reset_side_effect_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='access-reset')


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserMeView(generics.RetrieveUpdateAPIView):
    """Retrieve or update the currently authenticated user's profile."""
    serializer_class = UserMeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        user = serializer.save()
        if user.role == User.ROLE_PARENT:
            sync_parent(user)


class UserListCreateView(generics.ListCreateAPIView):
    """Admin-only: list all users or create a new user."""
    queryset = User.objects.all().order_by('-date_joined')
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserListSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        if user.role == User.ROLE_PARENT:
            sync_parent(user)

    filterset_fields = ['role', 'is_active']
    search_fields = ['username', 'access_code', 'first_name', 'last_name', 'email', 'kcs_card_id']


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin-only: retrieve, update, or deactivate a user."""
    queryset = User.objects.all()
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserCreateSerializer
        return UserListSerializer

    def perform_update(self, serializer):
        user = serializer.save()
        if user.role == User.ROLE_PARENT:
            sync_parent(user)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        if user.role == User.ROLE_PARENT:
            children = list(user.children.select_related('user', 'parent'))
            active_children = [child for child in children if child.is_active]

            with transaction.atomic():
                for child in children:
                    child.is_active = False
                    child.save(update_fields=['is_active'])
                    child.user.is_active = False
                    child.user.save(update_fields=['is_active'])

                user.is_active = False
                user.save(update_fields=['is_active'])

                def _sync_parent_deactivation():
                    for child in active_children:
                        delete_student(child)
                    delete_parent(user)

                transaction.on_commit(_sync_parent_deactivation)

            return Response({'detail': 'User deactivated.'}, status=status.HTTP_200_OK)

        if user.role == User.ROLE_STUDENT and hasattr(user, 'student_profile'):
            student = user.student_profile
            parent = student.parent

            with transaction.atomic():
                user.is_active = False
                user.save(update_fields=['is_active'])

                student.is_active = False
                student.save(update_fields=['is_active'])

                def _sync_student_deactivation():
                    delete_student(student)
                    if parent is not None:
                        sync_parent(parent)

                transaction.on_commit(_sync_student_deactivation)

            return Response({'detail': 'User deactivated.'}, status=status.HTTP_200_OK)

        if hasattr(user, 'teacher_profile'):
            deactivate_teacher(user.teacher_profile)
            return Response({'detail': 'User deactivated.'}, status=status.HTTP_200_OK)

        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'detail': 'User deactivated.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data['new_password'])
    request.user.must_change_password = False
    request.user.password_generated_by_system = False
    request.user.save(update_fields=['password', 'must_change_password', 'password_generated_by_system'])
    if request.user.role == User.ROLE_PARENT:
        sync_parent(request.user)
    elif request.user.role == User.ROLE_STUDENT and hasattr(request.user, 'student_profile'):
        sync_student(request.user.student_profile)
    elif request.user.role in (User.ROLE_TEACHER, User.ROLE_EMPLOYEE) and hasattr(request.user, 'teacher_profile'):
        sync_teacher(request.user.teacher_profile)
    return Response({'detail': 'Password changed successfully.'})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def reset_user_access(request, pk):
    user = User.objects.filter(pk=pk, is_active=True).first()
    if not user:
        return Response({'detail': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(reset_user_access_credentials(user))


@api_view(['POST'])
@permission_classes([IsAdminUser])
def reset_entity_access(request, entity_type, identifier):
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
        from apps.students.models import Student
        student = Student.objects.select_related('user').filter(is_active=True).filter(
            Q(student_id__iexact=identifier) | Q(user__username__iexact=identifier)
            | Q(user__kcs_card_id__iexact=identifier) | Q(user__access_code__iexact=identifier)
            | Q(user__email__iexact=identifier)
        ).first()
        user = student.user if student else None
        if not user:
            user = provision_student_access_identity(identifier, request.data)
    elif entity_type in ('employee', 'teacher'):
        from apps.teachers.models import Teacher
        teacher = Teacher.objects.select_related('user').filter(is_active=True).filter(
            Q(teacher_id__iexact=identifier) | Q(user__username__iexact=identifier)
            | Q(user__kcs_card_id__iexact=identifier) | Q(user__access_code__iexact=identifier)
            | Q(user__email__iexact=identifier)
        ).first()
        user = teacher.user if teacher else None
    else:
        return Response({'detail': 'Type d\'entite non pris en charge.'}, status=status.HTTP_400_BAD_REQUEST)

    if not user:
        return Response({'detail': 'Compte utilisateur introuvable pour cette entite.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(reset_user_access_credentials(user))


def provision_parent_access_identity(identifier, data=None):
    data = data or {}
    email = str(data.get('email') or '').strip().lower()
    phone = str(data.get('phone') or '').strip()
    if email:
        existing = User.objects.filter(email__iexact=email, is_active=True).first()
        if existing:
            return existing if existing.role == User.ROLE_PARENT else None

    full_name = str(data.get('fullName') or '').strip()
    parts = full_name.split()
    last_name = str(data.get('lastName') or (parts[0] if parts else '')).strip()
    first_name = str(data.get('firstName') or (parts[-1] if len(parts) > 1 else '')).strip()
    middle_name = str(data.get('middleName') or (' '.join(parts[1:-1]) if len(parts) > 2 else '')).strip()
    username = str(data.get('parentNumber') or identifier).strip()[:150]
    if not username:
        return None
    collision = User.objects.filter(username__iexact=username).first()
    if collision:
        return collision if collision.role == User.ROLE_PARENT else None

    user = User(
        username=username,
        role=User.ROLE_PARENT,
        first_name=first_name,
        middle_name=middle_name,
        last_name=last_name,
        email=email,
        phone=phone,
    )
    user.set_unusable_password()
    user.save()
    return user

def provision_student_access_identity(identifier, data=None):
    data = data or {}
    existing = User.objects.filter(role=User.ROLE_STUDENT, is_active=True).filter(
        Q(username__iexact=identifier) | Q(kcs_card_id__iexact=identifier)
        | Q(access_code__iexact=identifier) | Q(email__iexact=identifier)
    ).first()
    if existing:
        return existing

    full_name = str(data.get('fullName') or '').strip()
    parts = full_name.split()
    last_name = str(data.get('lastName') or (parts[0] if parts else '')).strip()
    first_name = str(data.get('firstName') or (parts[-1] if len(parts) > 1 else '')).strip()
    middle_name = str(data.get('middleName') or (' '.join(parts[1:-1]) if len(parts) > 2 else '')).strip()
    username = str(data.get('studentNumber') or identifier).strip()[:150]
    if not username:
        return None
    collision = User.objects.filter(username__iexact=username).first()
    if collision:
        return collision if collision.role == User.ROLE_STUDENT else None

    user = User(
        username=username,
        role=User.ROLE_STUDENT,
        first_name=first_name,
        middle_name=middle_name,
        last_name=last_name,
        email=str(data.get('email') or '').strip(),
        phone=str(data.get('phone') or '').strip(),
    )
    user.set_unusable_password()
    user.save()
    return user


def _deliver_reset_side_effects(user_id, subject, body, channels):
    close_old_connections()
    try:
        user = User.objects.get(pk=user_id)
        if user.role == User.ROLE_PARENT:
            sync_parent(user)
        elif user.role == User.ROLE_STUDENT and hasattr(user, 'student_profile'):
            sync_student(user.student_profile)
        elif user.role in (User.ROLE_TEACHER, User.ROLE_EMPLOYEE) and hasattr(user, 'teacher_profile'):
            sync_teacher(user.teacher_profile)

        if user.role in (User.ROLE_TEACHER, User.ROLE_EMPLOYEE) and hasattr(user, 'teacher_profile'):
            deliver_employee_communication(user.teacher_profile, subject, body)
        else:
            deliver_direct_parent_contact(
                name=user.get_full_name() or user.username,
                email=user.email,
                phone=user.phone,
                subject=subject,
                body=body,
                channels=channels,
            )
    except Exception:
        logger.exception('Deferred access reset delivery failed for user %s', user_id)
    finally:
        close_old_connections()


def reset_user_access_credentials(user, defer_side_effects=False):
    temporary_password = generate_temporary_password(user.role)
    user.set_password(temporary_password)
    user.must_change_password = True
    user.password_generated_by_system = True
    user.save(update_fields=['password', 'must_change_password', 'password_generated_by_system'])

    subject = 'Nouveaux identifiants temporaires KCS'
    body = (
        f'Bonjour {user.get_full_name() or user.username},\n\n'
        'Votre mot de passe a été réinitialisé par un administrateur.\n'
        f'Identifiant: {user.username}\n'
        f"Code d'accès: {user.access_code or 'non défini'}\n"
        f'Mot de passe temporaire: {temporary_password}\n\n'
        'Changez ce mot de passe lors de votre prochaine connexion.'
    )
    channels = ['email'] if user.role == User.ROLE_STUDENT else ['email', 'sms']

    if defer_side_effects:
        _reset_side_effect_executor.submit(_deliver_reset_side_effects, user.pk, subject, body, channels)
        delivery = [
            {'channel': channel, 'status': 'queued', 'detail': 'Delivery scheduled.'}
            for channel in channels
        ]
    else:
        if user.role == User.ROLE_PARENT:
            sync_parent(user)
        elif user.role == User.ROLE_STUDENT and hasattr(user, 'student_profile'):
            sync_student(user.student_profile)
        elif user.role in (User.ROLE_TEACHER, User.ROLE_EMPLOYEE) and hasattr(user, 'teacher_profile'):
            sync_teacher(user.teacher_profile)

        if user.role in (User.ROLE_TEACHER, User.ROLE_EMPLOYEE) and hasattr(user, 'teacher_profile'):
            results = deliver_employee_communication(user.teacher_profile, subject, body)
        else:
            results = deliver_direct_parent_contact(
                name=user.get_full_name() or user.username,
                email=user.email,
                phone=user.phone,
                subject=subject,
                body=body,
                channels=channels,
            )
        delivery = [result.__dict__ for result in results]

    return {
        'userId': user.pk,
        'username': user.username,
        'accessCode': user.access_code,
        'temporaryPassword': temporary_password,
        'mustChangePassword': True,
        'delivery': delivery,
    }


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def forgot_password(request):
    email = (request.data.get('email') or '').strip().lower()
    channel = (request.data.get('channel') or 'email').strip().lower()
    if channel not in ('email', 'sms'):
        return Response(PASSWORD_RESET_RESPONSE)
    try:
        validate_email(email)
    except ValidationError:
        return Response(PASSWORD_RESET_RESPONSE)

    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user:
        temporary_password = generate_temporary_password()
        message = (
            f'Bonjour {user.get_full_name() or user.username},\n\n'
            'Une demande de réinitialisation de mot de passe a été faite pour votre compte SAVANEX.\n'
            f'Identifiant: {user.email}\n'
            f'Nouveau mot de passe temporaire: {temporary_password}\n\n'
            'Pour votre sécurité, changez ce mot de passe après votre prochaine connexion.\n\n'
            "Ignorez ce message si vous n'êtes pas à l'origine de la demande."
        )
        try:
            if channel == 'sms':
                delivery = _send_user_sms(user, f'Nouveau mot de passe temporaire: {temporary_password}\nChangez-le après votre connexion.', 'Password recovery')
                delivered = delivery.status == 'sent'
            else:
                delivered = bool(send_branded_email(user.email, 'Nouveau mot de passe temporaire SAVANEX', message))
            if delivered:
                user.set_password(temporary_password)
                user.must_change_password = True
                user.password_generated_by_system = True
                user.save(update_fields=['password', 'must_change_password', 'password_generated_by_system'])
            else:
                logger.warning('[auth] SAVANEX password recovery was not applied because delivery failed via %s.', channel)
        except Exception:
            logger.exception('[auth] SAVANEX password recovery delivery failed via %s.', channel)

    return Response(PASSWORD_RESET_RESPONSE)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    uid = (request.data.get('uid') or '').strip()
    token = (request.data.get('token') or '').strip()
    password = request.data.get('password') or ''

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except Exception:
        user = None

    if not user or not default_token_generator.check_token(user, token):
        return Response({'detail': 'Password reset link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        return Response({'password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.must_change_password = False
    user.password_generated_by_system = False
    user.save(update_fields=['password', 'must_change_password', 'password_generated_by_system'])
    return Response({'detail': 'Password reset completed.'})


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def update_institutional_email(request, pk):
    user = User.objects.filter(pk=pk, is_active=True).first()
    if not user:
        return Response({'detail': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    if user.role not in {User.ROLE_STUDENT, User.ROLE_TEACHER, User.ROLE_EMPLOYEE}:
        return Response({'detail': 'Institutional email applies only to students and staff.'}, status=status.HTTP_400_BAD_REQUEST)
    email = str(request.data.get('institutionalEmail') or '').strip().lower()
    reason = str(request.data.get('reason') or '').strip()
    if not reason:
        return Response({'reason': 'A change reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_email(email)
    except ValidationError:
        return Response({'institutionalEmail': 'Invalid email.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
        return Response({'institutionalEmail': 'Email already belongs to another person.'}, status=status.HTTP_409_CONFLICT)
    old_value = user.email or ''
    if old_value.lower() == email:
        return Response({'detail': 'Email is unchanged.', 'email': email})
    with transaction.atomic():
        user.email = email
        user.save(update_fields=['email', 'updated_at'])
        InstitutionalEmailAudit.objects.create(user=user, old_value=old_value, new_value=email, changed_by=request.user, reason=reason)
        if user.role == User.ROLE_STUDENT and hasattr(user, 'student_profile'):
            transaction.on_commit(lambda: sync_student(user.student_profile))
        elif user.role in {User.ROLE_TEACHER, User.ROLE_EMPLOYEE} and hasattr(user, 'teacher_profile'):
            transaction.on_commit(lambda: sync_teacher(user.teacher_profile))
    return Response({'email': email, 'oldValue': old_value, 'changedBy': request.user.pk, 'reason': reason})
