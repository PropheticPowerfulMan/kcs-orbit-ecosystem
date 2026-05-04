from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AcademicYearViewSet,
    LevelViewSet,
    SubjectViewSet,
    ClassViewSet,
    ClassSubjectViewSet,
)

router = DefaultRouter()
router.register(r'academic-years', AcademicYearViewSet, basename='academic-year')
router.register(r'levels', LevelViewSet, basename='level')
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'groups', ClassViewSet, basename='class')
router.register(r'assignments', ClassSubjectViewSet, basename='class-subject')

urlpatterns = [
    path('', include(router.urls)),
]
