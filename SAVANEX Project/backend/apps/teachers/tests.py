from django.test import TestCase

from apps.teachers.models import Teacher
from apps.teachers.serializers import TeacherCreateSerializer
from apps.users.models import User


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
