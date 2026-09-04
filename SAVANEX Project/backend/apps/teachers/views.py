from rest_framework import generics, status
from rest_framework.response import Response
from apps.communication.models import Notification
from apps.communication.services import deliver_employee_communication
from apps.integration.orbit import sync_teacher
from .services import deactivate_teacher
from .models import Teacher
from .serializers import TeacherSerializer, TeacherCreateSerializer, TeacherDetailSerializer
from apps.users.permissions import IsAdminUser, IsTeacherOrAdmin, IsOwnerOrAdmin


def finalize_teacher_creation(teacher):
    sync_teacher(teacher)
    password=getattr(teacher.user,'_generated_password',None)
    apps=['EduPay']+(['KCS Nexus'] if teacher.is_teaching_employee else [])
    subject='Vos accès institutionnels KCS sont actifs'
    body=(f"Bonjour {teacher.full_name or teacher.user.username},\nVotre profil employé KCS est actif.\n\nApplications : {', '.join(apps)}.\nMatricule : {teacher.employee_id}.\nIdentifiant : {teacher.user.email}.\nCode d’accès : {teacher.user.access_code}.\n"+(f"Mot de passe temporaire : {password}.\n\n" if password else '\n')+"Ce mot de passe doit être changé à la première connexion.")
    return deliver_employee_communication(teacher,subject,body,notif_type=Notification.TYPE_ANNOUNCEMENT,link='/teachers')


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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        teacher = serializer.save()
        delivery = finalize_teacher_creation(teacher)
        response_data = serializer.to_representation(teacher)
        response_data['temporaryCredentials']['delivery'] = [
            {'channel': item.channel, 'status': item.status, 'detail': item.detail}
            for item in delivery
        ]
        return Response(response_data, status=status.HTTP_201_CREATED, headers=self.get_success_headers(response_data))


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
