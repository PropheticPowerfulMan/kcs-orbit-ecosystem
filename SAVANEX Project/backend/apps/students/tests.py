from datetime import date
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.throttling import ScopedRateThrottle

from apps.integration.orbit import sync_parent, sync_student
from apps.students.models import Student
from apps.students.serializers import FamilyRegistrationSerializer
from apps.students.views import FamilyRegistrationView, StudentDetailView
from apps.users.models import User
from apps.users.views import UserDetailView


class FamilyRegistrationSerializerTests(TestCase):
    def test_family_registration_uses_an_independent_throttle_scope(self):
        view = FamilyRegistrationView()

        self.assertEqual(view.throttle_scope, "family_registration")
        self.assertEqual(view.throttle_classes, [ScopedRateThrottle])
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
        self.assertTrue(parent.username.startswith("SAV-PAR-"))
        self.assertEqual(len(students), 2)
        self.assertEqual(Student.objects.filter(parent=parent).count(), 2)
        self.assertTrue(all(student.student_id.startswith("SAV-STU-") for student in students))
        self.assertEqual({student.parent_id for student in students}, {parent.id})
        mock_sync_parent.assert_called_once_with(parent)
        self.assertEqual(mock_sync_student.call_count, 2)

    @patch("apps.students.serializers.sync_student")
    @patch("apps.students.serializers.sync_parent")
    def test_recreates_a_deleted_family_with_the_same_emails(self, mock_sync_parent, mock_sync_student):
        initial_payload = {
            "parent": {
                "first_name": "Mireille",
                "last_name": "Levana",
                "email": "parent.levana@example.com",
                "phone": "+243000000333",
            },
            "students": [{
                "user": {
                    "first_name": "Ancien Prenom",
                    "last_name": "Levana",
                    "email": "levana@gmail.com",
                },
                "date_of_birth": "2015-02-10",
                "gender": "F",
            }],
        }
        first_serializer = FamilyRegistrationSerializer(data=initial_payload)
        self.assertTrue(first_serializer.is_valid(), first_serializer.errors)
        with self.captureOnCommitCallbacks(execute=True):
            first_family = first_serializer.save()

        original_parent = first_family["parent"]
        original_student = first_family["students"][0]
        original_user = original_student.user
        original_parent.is_active = False
        original_parent.save(update_fields=["is_active"])
        original_user.is_active = False
        original_user.save(update_fields=["is_active"])
        original_student.is_active = False
        original_student.save(update_fields=["is_active"])

        recreated_payload = {
            **initial_payload,
            "students": [{
                **initial_payload["students"][0],
                "user": {
                    **initial_payload["students"][0]["user"],
                    "first_name": "Nouveau Prenom",
                },
            }],
        }
        second_serializer = FamilyRegistrationSerializer(data=recreated_payload)
        self.assertTrue(second_serializer.is_valid(), second_serializer.errors)
        with self.captureOnCommitCallbacks(execute=True):
            recreated_family = second_serializer.save()

        recreated_parent = recreated_family["parent"]
        recreated_student = recreated_family["students"][0]
        recreated_parent.refresh_from_db()
        recreated_student.refresh_from_db()
        recreated_student.user.refresh_from_db()

        self.assertEqual(recreated_parent.pk, original_parent.pk)
        self.assertEqual(recreated_student.pk, original_student.pk)
        self.assertEqual(recreated_student.user_id, original_user.pk)
        self.assertTrue(recreated_parent.is_active)
        self.assertTrue(recreated_student.is_active)
        self.assertTrue(recreated_student.user.is_active)
        self.assertEqual(recreated_student.user.first_name, "Nouveau Prenom")
        self.assertEqual(User.objects.filter(email__iexact="levana@gmail.com").count(), 1)
        self.assertEqual(Student.objects.filter(user__email__iexact="levana@gmail.com").count(), 1)

    @patch("apps.students.serializers.sync_student")
    @patch("apps.students.serializers.sync_parent")
    def test_reuses_an_active_local_student_removed_from_orbit(self, mock_sync_parent, mock_sync_student):
        parent = User.objects.create_user(
            username="SAV-PAR-ORPHAN",
            email="parent.orphan@example.com",
            first_name="Mireille",
            last_name="Levana",
            role=User.ROLE_PARENT,
        )
        student_user = User.objects.create_user(
            username="student-orphan",
            email="levana@gmail.com",
            first_name="Ancien",
            last_name="Levana",
            role=User.ROLE_STUDENT,
        )
        student = Student.objects.create(
            user=student_user,
            parent=parent,
            student_id="SAV-STU-ORPHAN",
            date_of_birth=date(2015, 2, 10),
            gender="F",
        )
        payload = {
            "parent": {
                "first_name": "Mireille",
                "last_name": "Levana",
                "email": "parent.orphan@example.com",
            },
            "students": [{
                "user": {
                    "first_name": "Nouveau",
                    "last_name": "Levana",
                    "email": "levana@gmail.com",
                },
                "date_of_birth": "2015-02-10",
                "gender": "F",
            }],
        }

        with patch("apps.students.serializers.orbit_sync_is_enabled", return_value=True), patch(
            "apps.students.serializers.fetch_shared_directory",
            return_value={"source": "orbit", "students": []},
        ):
            serializer = FamilyRegistrationSerializer(data=payload)
            self.assertTrue(serializer.is_valid(), serializer.errors)
            with self.captureOnCommitCallbacks(execute=True):
                recreated = serializer.save()

        self.assertEqual(recreated["students"][0].pk, student.pk)
        self.assertEqual(recreated["students"][0].user_id, student_user.pk)
        self.assertEqual(User.objects.filter(email__iexact="levana@gmail.com").count(), 1)

class OrbitSyncPayloadTests(TestCase):
    @patch("apps.integration.orbit._post_json")
    def test_sync_parent_and_student_emit_contract_safe_payloads(self, mock_post_json):
        parent = User.objects.create_user(
            username="SAV-PAR-CONTRACT",
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
        self.assertEqual(parent_payload["externalId"], "SAV-PAR-CONTRACT")
        self.assertEqual(student_payload["payload"]["studentNumber"], "STU-CONTRACT-001")
        self.assertEqual(student_payload["payload"]["parentExternalId"], "SAV-PAR-CONTRACT")


class DeactivationSyncTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user(
            username="admin-sync",
            email="admin.sync@example.com",
            password="AdminPass123!",
            first_name="Admin",
            last_name="Sync",
            role=User.ROLE_ADMIN,
        )

    @patch("apps.students.views.sync_parent")
    @patch("apps.students.views.delete_student")
    def test_student_destroy_removes_orbit_student_and_refreshes_parent(self, mock_delete_student, mock_sync_parent):
        parent = User.objects.create_user(
            username="parent-destroy",
            email="parent.destroy@example.com",
            password="ParentPass123!",
            first_name="Mireille",
            last_name="Kasongo",
            role=User.ROLE_PARENT,
        )
        student_user = User.objects.create_user(
            username="student-destroy",
            email="student.destroy@example.com",
            password="StudentPass123!",
            first_name="Nadia",
            last_name="Kasongo",
            role=User.ROLE_STUDENT,
        )
        student = Student.objects.create(
            user=student_user,
            student_id="STU-DELETE-001",
            date_of_birth=date(2014, 5, 12),
            gender="F",
            parent=parent,
        )

        request = self.factory.delete(f"/api/students/{student.pk}/")
        force_authenticate(request, user=self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            response = StudentDetailView.as_view()(request, pk=student.pk)

        self.assertEqual(response.status_code, 200)
        student.refresh_from_db()
        student_user.refresh_from_db()
        self.assertFalse(student.is_active)
        self.assertFalse(student_user.is_active)
        mock_delete_student.assert_called_once_with(student)
        mock_sync_parent.assert_called_once_with(parent)

    @patch("apps.users.views.delete_student")
    @patch("apps.users.views.delete_parent")
    def test_parent_destroy_deactivates_children_and_removes_orbit_family(self, mock_delete_parent, mock_delete_student):
        parent = User.objects.create_user(
            username="parent-detach",
            email="parent.detach@example.com",
            password="ParentPass123!",
            first_name="Patrick",
            last_name="Kalonji",
            role=User.ROLE_PARENT,
        )
        child_user = User.objects.create_user(
            username="child-detach",
            email="child.detach@example.com",
            password="StudentPass123!",
            first_name="Nathan",
            last_name="Kalonji",
            role=User.ROLE_STUDENT,
        )
        child = Student.objects.create(
            user=child_user,
            student_id="STU-DETACH-001",
            date_of_birth=date(2013, 8, 4),
            gender="M",
            parent=parent,
        )

        request = self.factory.delete(f"/api/users/{parent.pk}/")
        force_authenticate(request, user=self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            response = UserDetailView.as_view()(request, pk=parent.pk)

        self.assertEqual(response.status_code, 200)
        parent.refresh_from_db()
        child.refresh_from_db()
        self.assertFalse(parent.is_active)
        self.assertFalse(child.is_active)
        child_user.refresh_from_db()
        self.assertFalse(child_user.is_active)
        mock_delete_student.assert_called_once_with(child)
        mock_delete_parent.assert_called_once_with(parent)
