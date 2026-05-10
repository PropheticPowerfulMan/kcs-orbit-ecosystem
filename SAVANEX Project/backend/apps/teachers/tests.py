from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.teachers.models import Teacher
from apps.teachers.serializers import TeacherSerializer
from apps.teachers.serializers import TeacherCreateSerializer
from apps.teachers.views import TeacherDetailView
from apps.users.models import User
from apps.users.views import UserDetailView


class TeacherCreateSerializerTests(TestCase):
    def test_generates_coherent_savanex_employee_ids(self):
        serializer = TeacherCreateSerializer(
            data={
                "user": {
                    "first_name": "Aline",
                    "last_name": "Mbuyi",
                    "email": "aline.mbuyi@example.com",
                    "password": "EmployeePass123!",
                },
                "employee_type": Teacher.EMPLOYEE_TYPE_ADMINISTRATIVE,
                "hire_date": "2026-05-06",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        employee = serializer.save()

        self.assertEqual(employee.user.role, User.ROLE_EMPLOYEE)
        self.assertTrue(employee.employee_id.startswith("SAV-EMP-"))
        self.assertEqual(employee.teacher_id, employee.employee_id)


class TeacherDeactivationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user(
            username="admin-teacher-tests",
            email="admin.teacher.tests@example.com",
            password="AdminPass123!",
            first_name="Admin",
            last_name="Teacher",
            role=User.ROLE_ADMIN,
        )

    def _create_teacher(self, username: str, email: str) -> Teacher:
        user = User.objects.create_user(
            username=username,
            email=email,
            password="TeacherPass123!",
            first_name="Aline",
            last_name="Mbuyi",
            role=User.ROLE_TEACHER,
        )
        return Teacher.objects.create(
            user=user,
            teacher_id=f"TCH-{username.upper()}",
            employee_id=f"EMP-{username.upper()}",
            hire_date="2026-05-06",
            employment_status=Teacher.STATUS_ACTIVE,
        )

    @patch("apps.teachers.services.sync_teacher")
    def test_teacher_destroy_deactivates_teacher_user_and_syncs_inactive_status(self, mock_sync_teacher):
        teacher = self._create_teacher("teacher-destroy", "teacher.destroy@example.com")

        request = self.factory.delete(f"/api/teachers/{teacher.pk}/")
        force_authenticate(request, user=self.admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = TeacherDetailView.as_view()(request, pk=teacher.pk)

        self.assertEqual(response.status_code, 200)
        teacher.refresh_from_db()
        teacher.user.refresh_from_db()
        self.assertFalse(teacher.is_active)
        self.assertFalse(teacher.user.is_active)
        self.assertEqual(teacher.employment_status, Teacher.STATUS_INACTIVE)
        mock_sync_teacher.assert_called_once_with(teacher)

    @patch("apps.teachers.services.sync_teacher")
    def test_user_destroy_deactivates_related_teacher_profile(self, mock_sync_teacher):
        teacher = self._create_teacher("teacher-user-destroy", "teacher.user.destroy@example.com")

        request = self.factory.delete(f"/api/users/{teacher.user.pk}/")
        force_authenticate(request, user=self.admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = UserDetailView.as_view()(request, pk=teacher.user.pk)

        self.assertEqual(response.status_code, 200)
        teacher.refresh_from_db()
        teacher.user.refresh_from_db()
        self.assertFalse(teacher.user.is_active)
        self.assertFalse(teacher.is_active)
        self.assertEqual(teacher.employment_status, Teacher.STATUS_INACTIVE)
        mock_sync_teacher.assert_called_once_with(teacher)


class TeacherUpdateSerializerTests(TestCase):
    def test_update_can_modify_related_user_fields(self):
        user = User.objects.create_user(
            username="teacher-update-user",
            email="teacher.update.user@example.com",
            password="TeacherPass123!",
            first_name="Aline",
            last_name="Mbuyi",
            phone="+243000000001",
            role=User.ROLE_TEACHER,
        )
        teacher = Teacher.objects.create(
            user=user,
            teacher_id="TCH-UPDATE-USER",
            employee_id="EMP-UPDATE-USER",
            hire_date="2026-05-06",
        )

        serializer = TeacherSerializer(
            teacher,
            data={
                "first_name": "Amina",
                "last_name": "Kasongo",
                "user_email": "amina.kasongo@example.com",
                "phone": "+243000000099",
                "department": "Sciences",
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        teacher.refresh_from_db()
        teacher.user.refresh_from_db()
        self.assertEqual(teacher.user.first_name, "Amina")
        self.assertEqual(teacher.user.last_name, "Kasongo")
        self.assertEqual(teacher.user.email, "amina.kasongo@example.com")
        self.assertEqual(teacher.user.phone, "+243000000099")
        self.assertEqual(teacher.department, "Sciences")

    def test_update_normalizes_inactive_status_when_is_active_is_false(self):
        user = User.objects.create_user(
            username="teacher-update-status",
            email="teacher.update.status@example.com",
            password="TeacherPass123!",
            first_name="Aline",
            last_name="Mbuyi",
            role=User.ROLE_EMPLOYEE,
        )
        teacher = Teacher.objects.create(
            user=user,
            teacher_id="TCH-UPDATE-STATUS",
            employee_id="EMP-UPDATE-STATUS",
            hire_date="2026-05-06",
            employment_status=Teacher.STATUS_ACTIVE,
            is_active=True,
        )

        serializer = TeacherSerializer(
            teacher,
            data={"is_active": False},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        teacher.refresh_from_db()
        teacher.user.refresh_from_db()
        self.assertFalse(teacher.is_active)
        self.assertFalse(teacher.user.is_active)
        self.assertEqual(teacher.employment_status, Teacher.STATUS_INACTIVE)
