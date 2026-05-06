from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from apps.integration.orbit import delete_student, sync_parent, sync_student
from .models import Student
from .serializers import FamilyRegistrationSerializer, StudentSerializer, StudentCreateSerializer, StudentDetailSerializer
from apps.users.permissions import IsAdminUser, IsTeacherOrAdmin, IsOwnerOrAdmin


class StudentListCreateView(generics.ListCreateAPIView):
    queryset = Student.objects.select_related('user', 'current_class', 'parent').filter(is_active=True)
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ['current_class', 'gender', 'is_active']
    search_fields = ['user__first_name', 'user__last_name', 'student_id', 'user__email']
    ordering_fields = ['user__last_name', 'enrollment_date', 'student_id']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StudentCreateSerializer
        return StudentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsTeacherOrAdmin()]

    def perform_create(self, serializer):
        student = serializer.save()
        if student.parent_id:
            sync_parent(student.parent)
        sync_student(student)


class FamilyRegistrationView(generics.CreateAPIView):
    serializer_class = FamilyRegistrationSerializer
    permission_classes = [IsAdminUser]


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Student.objects.select_related('user', 'current_class', 'parent')
    permission_classes = [IsOwnerOrAdmin]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StudentSerializer
        return StudentDetailSerializer

    def perform_update(self, serializer):
        student = serializer.save()
        if student.parent_id:
            sync_parent(student.parent)
        sync_student(student)

    def destroy(self, request, *args, **kwargs):
        student = self.get_object()
        parent = student.parent

        with transaction.atomic():
            student.user.is_active = False
            student.user.save(update_fields=['is_active'])

            student.is_active = False
            student.save(update_fields=['is_active'])

            def _sync_deactivation():
                delete_student(student)
                if parent is not None:
                    sync_parent(parent)

            transaction.on_commit(_sync_deactivation)

        return Response({'detail': 'Student deactivated.'}, status=status.HTTP_200_OK)
