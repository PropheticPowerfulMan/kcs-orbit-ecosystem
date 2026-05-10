from rest_framework import generics, status
from rest_framework.response import Response
from apps.integration.orbit import sync_teacher
from .services import deactivate_teacher
from .models import Teacher
from .serializers import TeacherSerializer, TeacherCreateSerializer, TeacherDetailSerializer
from apps.users.permissions import IsAdminUser, IsTeacherOrAdmin, IsOwnerOrAdmin


class TeacherListCreateView(generics.ListCreateAPIView):
    queryset = Teacher.objects.select_related('user').filter(is_active=True)
    filterset_fields = ['employee_type', 'department', 'employment_status', 'contract_type', 'pay_frequency', 'specialization', 'is_active']
    search_fields = ['teacher_id', 'employee_id', 'job_title', 'work_email', 'national_id_number', 'user__first_name', 'user__last_name', 'user__email']
    ordering_fields = ['teacher_id', 'employee_id', 'user__last_name', 'hire_date']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsTeacherOrAdmin()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TeacherCreateSerializer
        return TeacherSerializer

    def perform_create(self, serializer):
        teacher = serializer.save()
        sync_teacher(teacher)


class TeacherDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Teacher.objects.select_related('user')

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdminUser()]
        return [IsOwnerOrAdmin()]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return TeacherSerializer
        return TeacherDetailSerializer

    def perform_update(self, serializer):
        teacher = serializer.save()
        sync_teacher(teacher)

    def destroy(self, request, *args, **kwargs):
        teacher = self.get_object()
        deactivate_teacher(teacher)
        return Response({'detail': 'Teacher deactivated.'}, status=status.HTTP_200_OK)
