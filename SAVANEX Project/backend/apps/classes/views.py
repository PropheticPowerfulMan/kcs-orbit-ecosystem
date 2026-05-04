from rest_framework import viewsets, permissions
from apps.integration.orbit import sync_class, sync_teacher
from .models import AcademicYear, Level, Class, Subject, ClassSubject
from .serializers import (
    AcademicYearSerializer,
    LevelSerializer,
    ClassSerializer,
    ClassDetailSerializer,
    SubjectSerializer,
    ClassSubjectSerializer,
)
from apps.users.permissions import IsAdminUser, IsTeacherOrAdmin


class AdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all().order_by('-start_date')
    serializer_class = AcademicYearSerializer
    permission_classes = [AdminOrReadOnly]


class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all().order_by('order')
    serializer_class = LevelSerializer
    permission_classes = [AdminOrReadOnly]


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all().order_by('name')
    serializer_class = SubjectSerializer
    permission_classes = [AdminOrReadOnly]
    search_fields = ['name', 'code']


class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.select_related('level', 'academic_year', 'class_teacher__user').all()
    permission_classes = [AdminOrReadOnly]
    filterset_fields = ['level', 'academic_year']
    search_fields = ['name', 'room']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClassDetailSerializer
        return ClassSerializer

    def perform_create(self, serializer):
        class_instance = serializer.save()
        if class_instance.class_teacher_id:
            sync_teacher(class_instance.class_teacher)
        sync_class(class_instance)

    def perform_update(self, serializer):
        class_instance = serializer.save()
        if class_instance.class_teacher_id:
            sync_teacher(class_instance.class_teacher)
        sync_class(class_instance)


class ClassSubjectViewSet(viewsets.ModelViewSet):
    queryset = ClassSubject.objects.select_related('class_instance', 'subject', 'teacher__user').all()
    serializer_class = ClassSubjectSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ['class_instance', 'subject', 'teacher']
