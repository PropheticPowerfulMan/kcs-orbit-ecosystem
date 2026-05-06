from django.db import transaction
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from apps.integration.orbit import delete_parent, delete_student, sync_parent, sync_student
from .models import User
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserMeSerializer,
    UserCreateSerializer,
    UserListSerializer,
    PasswordChangeSerializer,
)
from .permissions import IsAdminUser


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
    search_fields = ['username', 'first_name', 'last_name', 'email']


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
                    if child.parent_id == user.pk:
                        child.parent = None
                        child.save(update_fields=['parent'])

                user.is_active = False
                user.save(update_fields=['is_active'])

                def _sync_parent_deactivation():
                    for child in active_children:
                        sync_student(child)
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

        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'detail': 'User deactivated.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data['new_password'])
    request.user.save()
    return Response({'detail': 'Password changed successfully.'})
