from datetime import date
from unittest.mock import patch

from django.test import TestCase

from apps.integration.orbit import sync_parent, sync_student
from apps.students.models import Student
from apps.students.serializers import FamilyRegistrationSerializer
from apps.users.models import User


class FamilyRegistrationSerializerTests(TestCase):
    @patch("apps.students.serializers.sync_student")
    @patch("apps.students.serializers.sync_parent")
    def test_registers_one_parent_with_multiple_children_and_generated_ids(self, mock_sync_parent, mock_sync_student):
        serializer = FamilyRegistrationSerializer(
            data={
                "parent": {
                    "first_name": "Mireille",
                    "last_name": "Tshisekedi",
                    "email": "parent.test@example.com",
                    "password": "ParentPass123!",
                    "phone": "+243000000111",
                    "language": "fr",
                },
                "students": [
                    {
                        "user": {
                            "first_name": "Nadia",
                            "last_name": "Tshisekedi",
                            "email": "nadia.test@example.com",
                            "password": "StudentPass123!",
                            "language": "fr",
                        },
                        "date_of_birth": "2016-03-14",
                        "gender": "F",
                    },
                    {
                        "user": {
                            "first_name": "Bryan",
                            "last_name": "Tshisekedi",
                            "email": "bryan.test@example.com",
                            "password": "StudentPass123!",
                            "language": "fr",
                        },
                        "date_of_birth": "2014-09-21",
                        "gender": "M",
                    },
                ],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

        with self.captureOnCommitCallbacks(execute=True):
            created = serializer.save()

        parent = created["parent"]
        students = created["students"]

        self.assertEqual(parent.role, User.ROLE_PARENT)
        self.assertEqual(len(students), 2)
        self.assertEqual(Student.objects.filter(parent=parent).count(), 2)
        self.assertTrue(all(student.student_id.startswith("STU-") for student in students))
        self.assertEqual({student.parent_id for student in students}, {parent.id})
        mock_sync_parent.assert_called_once_with(parent)
        self.assertEqual(mock_sync_student.call_count, 2)


class OrbitSyncPayloadTests(TestCase):
    @patch("apps.integration.orbit._post_json")
    def test_sync_parent_and_student_emit_contract_safe_payloads(self, mock_post_json):
        parent = User.objects.create_user(
            username="parent-contract",
            email="parent.contract@example.com",
            password="ParentPass123!",
            first_name="Mireille",
            last_name="Tshisekedi",
            role=User.ROLE_PARENT,
            phone="+243000000222",
        )
        student_user = User.objects.create_user(
            username="student-contract",
            email="student.contract@example.com",
            password="StudentPass123!",
            first_name="Nadia",
            last_name="Tshisekedi",
            role=User.ROLE_STUDENT,
            phone="",
        )
        student = Student.objects.create(
            user=student_user,
            student_id="STU-CONTRACT-001",
            date_of_birth=date(2016, 3, 14),
            gender="F",
            parent=parent,
        )

        sync_parent(parent)
        sync_student(student)

        self.assertEqual(mock_post_json.call_count, 3)

        parent_path, parent_payload = mock_post_json.call_args_list[0].args
        student_path, student_payload = mock_post_json.call_args_list[-1].args

        self.assertEqual(parent_path, "/api/integration/ingest/savanex/parents")
        self.assertEqual(student_path, "/api/integration/ingest/savanex/students")
        self.assertTrue(parent_payload["occurredAt"].endswith("Z"))
        self.assertTrue(student_payload["occurredAt"].endswith("Z"))
        self.assertNotIn("classExternalId", student_payload["payload"])
        self.assertNotIn("phone", student_payload["payload"])
        self.assertEqual(student_payload["payload"]["parentExternalId"], str(parent.pk))
