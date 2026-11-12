from unittest.mock import patch

from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.users.models import User
from apps.teachers.models import Teacher


class SharedDirectoryResilienceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='directory-admin',
            password='TemporaryPass123!',
            role=User.ROLE_ADMIN,
        )
        self.client.force_authenticate(self.user)

    @patch('apps.integration.views.orbit_sync_is_enabled', return_value=True)
    @patch('apps.integration.views.fetch_shared_directory')
    def test_shared_directory_reuses_short_lived_cache(self, fetch_directory, _enabled):
        fetch_directory.return_value = {'source': 'orbit', 'students': [{'id': 'student-1'}]}

        first = self.client.get('/api/integration/shared-directory/')
        second = self.client.get('/api/integration/shared-directory/')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second['X-KCS-Directory-Cache'], 'hit')
        fetch_directory.assert_called_once()

    @patch('apps.integration.views.orbit_sync_is_enabled', return_value=True)
    @patch('apps.integration.views.fetch_shared_directory')
    def test_shared_directory_uses_verified_stale_copy_when_orbit_is_slow(self, fetch_directory, _enabled):
        cached_directory = {'source': 'orbit', 'parents': [{'id': 'parent-1'}]}
        cache.set('savanex:shared-directory:v2:stale', cached_directory, timeout=60)
        fetch_directory.side_effect = TimeoutError('Orbit timeout')

        response = self.client.get('/api/integration/shared-directory/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'orbit')
        self.assertEqual(response.data['parents'], cached_directory['parents'])
        self.assertEqual(response.data['counts'], {'families': 0, 'parents': 1, 'students': 0, 'teachers': 0})
        self.assertEqual(response['X-KCS-Directory-Cache'], 'stale')

    @patch('apps.integration.views.orbit_sync_is_enabled', return_value=True)
    @patch('apps.integration.views.fetch_shared_directory', side_effect=TimeoutError('Orbit timeout'))
    def test_shared_directory_returns_explicit_service_error_without_cache(self, _fetch_directory, _enabled):
        response = self.client.get('/api/integration/shared-directory/')

        self.assertEqual(response.status_code, 503)
        self.assertIn('momentanément indisponible', response.data['detail'])


@override_settings(
    KCS_NEXUS_AUTH_KEY='nexus-test-key',
    EDUPAY_AUTH_KEY='edupay-test-key',
    EDUSYNC_AUTH_KEY='edusync-test-key',
)
class EcosystemIdentifierAuthenticationTests(TestCase):
    password = 'TemporaryPass123!'

    def setUp(self):
        self.client = APIClient()

    def test_all_federated_roles_accept_generated_identifiers(self):
        for index, role in enumerate((User.ROLE_PARENT, User.ROLE_STUDENT, User.ROLE_TEACHER, User.ROLE_EMPLOYEE)):
            user = User.objects.create_user(
                username=f'generated-{role}',
                email=f'{role}@ourkcs.org',
                password=self.password,
                role=role,
                access_code=f'ACC-{role[:3].upper()}-{index:06d}',
                kcs_card_id=f'KCS-{role[:3].upper()}-{index:06d}',
            )
            for identifier in (user.username, user.email, user.access_code, user.kcs_card_id):
                response = self.client.post(
                    '/api/integration/authenticate/',
                    {'identifier': identifier, 'password': self.password},
                    format='json',
                    HTTP_X_API_KEY='nexus-test-key',
                )
                self.assertEqual(response.status_code, 200, (role, identifier, response.data))
                self.assertEqual(response.data['user']['id'], user.id)

    def test_each_authorized_application_key_is_accepted(self):
        user = User.objects.create_user(
            username='all-apps-teacher',
            email='all.apps.teacher@ourkcs.org',
            password=self.password,
            role=User.ROLE_TEACHER,
        )
        Teacher.objects.create(user=user, teacher_id='SAV-TCH-ALLAPPS', personal_email='all.apps.personal@example.com', hire_date='2026-09-01')
        for api_key in ('nexus-test-key', 'edupay-test-key', 'edusync-test-key'):
            for identifier in (user.email, user.teacher_profile.personal_email):
                response = self.client.post(
                    '/api/integration/authenticate/',
                    {'identifier': identifier, 'password': self.password},
                    format='json',
                    HTTP_X_API_KEY=api_key,
                )
                self.assertEqual(response.status_code, 200)

    def test_shared_contact_email_is_disambiguated_by_password(self):
        parent = User.objects.create_user(
            username='shared-contact-parent',
            email='shared.contact@example.com',
            password='ParentPassword123!',
            role=User.ROLE_PARENT,
        )
        teacher_user = User.objects.create_user(
            username='shared-contact-teacher',
            email='teacher@ourkcs.org',
            password='TeacherPassword123!',
            role=User.ROLE_TEACHER,
        )
        Teacher.objects.create(
            user=teacher_user,
            teacher_id='SAV-TCH-SHARED',
            personal_email=parent.email,
            hire_date='2026-09-01',
        )

        for password, expected_user in (
            ('ParentPassword123!', parent),
            ('TeacherPassword123!', teacher_user),
        ):
            response = self.client.post(
                '/api/integration/authenticate/',
                {'identifier': parent.email, 'password': password},
                format='json',
                HTTP_X_API_KEY='nexus-test-key',
            )
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['user']['id'], expected_user.id)

    @patch('apps.integration.views.reset_user_access_credentials')
    def test_parent_reset_provisions_missing_parent_identity(self, reset_credentials):
        reset_credentials.return_value = {
            'username': 'parent-imported',
            'accessCode': 'ACC-PAR-000001',
            'temporaryPassword': 'KCS-123456',
            'mustChangePassword': True,
        }

        response = self.client.post(
            '/api/integration/entities/parent/parent-imported/reset-access/',
            {
                'fullName': 'Mbuyi Rachel',
                'firstName': 'Rachel',
                'lastName': 'Mbuyi',
                'email': 'rachel.parent@example.com',
                'phone': '+243810000000',
            },
            format='json',
            HTTP_X_API_KEY='edupay-test-key',
        )

        self.assertEqual(response.status_code, 200, response.data)
        parent = User.objects.get(email='rachel.parent@example.com')
        self.assertEqual(parent.role, User.ROLE_PARENT)
        self.assertEqual(parent.username, 'parent-imported')
        reset_credentials.assert_called_once_with(parent, defer_side_effects=False)

    @patch('apps.integration.views.sync_parent')
    def test_ecosystem_password_change_updates_authority_and_orbit(self, sync_parent):
        parent = User.objects.create_user(
            username='password-parent',
            email='password.parent@example.com',
            password='OldPassword123!',
            role=User.ROLE_PARENT,
            access_code='ACC-PAR-PASSWORD',
            must_change_password=True,
            password_generated_by_system=True,
        )
        response = self.client.post(
            '/api/integration/entities/parent/ACC-PAR-PASSWORD/change-password/',
            {'currentPassword': 'OldPassword123!', 'newPassword': 'Lynx!Quartz7Violet#92'},
            format='json',
            HTTP_X_API_KEY='nexus-test-key',
        )
        self.assertEqual(response.status_code, 200, response.data)
        parent.refresh_from_db()
        self.assertFalse(parent.check_password('OldPassword123!'))
        self.assertTrue(parent.check_password('Lynx!Quartz7Violet#92'))
        self.assertFalse(parent.must_change_password)
        self.assertFalse(parent.password_generated_by_system)
        sync_parent.assert_called_once_with(parent)

@override_settings(KCS_NEXUS_AUTH_KEY='nexus-test-key')
class EcosystemEmployeeIntegrationTests(TestCase):
    def setUp(self): self.client=APIClient()
    def test_employee_directory_rejects_missing_service_key(self):
        self.assertEqual(self.client.get('/api/integration/employees/').status_code,401)
    def test_employee_directory_accepts_nexus_service_key(self):
        response=self.client.get('/api/integration/employees/',HTTP_X_API_KEY='nexus-test-key')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.data,[])

    @patch('apps.integration.views.deliver_employee_communication')
    @patch('apps.integration.views.sync_teacher')
    def test_employee_update_normalizes_nullable_fields_and_notifies(self, sync_teacher, deliver):
        deliver.return_value = []
        user = User.objects.create_user(
            username='employee-update',
            email='employee.update.com',
            password='TemporaryPass123!',
            role=User.ROLE_TEACHER,
            first_name='Old',
            last_name='Name',
            phone='+243810000001',
        )
        teacher = Teacher.objects.create(
            user=user,
            teacher_id='SAV-TCH-UPDATE',
            employee_id='SAV-EMP-UPDATE',
            hire_date='2026-09-01',
        )

        response = self.client.patch(
            f'/api/integration/employees/{teacher.pk}/',
            {
                'first_name': 'Maria',
                'contract_duration_months': '',
                'birth_date': '',
                'base_salary': '',
            },
            format='json',
            HTTP_X_API_KEY='nexus-test-key',
        )

        self.assertEqual(response.status_code, 200, response.data)
        teacher.refresh_from_db()
        teacher.user.refresh_from_db()
        self.assertEqual(teacher.user.first_name, 'Maria')
        self.assertIsNone(teacher.contract_duration_months)
        self.assertIsNone(teacher.birth_date)
        self.assertIsNone(teacher.base_salary)
        sync_teacher.assert_called_once_with(teacher)
        deliver.assert_called_once()
        self.assertEqual(response.data['notificationDelivery'], [])


@override_settings(KCS_NEXUS_AUTH_KEY='synthetic-graduation-key')
class GraduationAccessTests(TestCase):
    def setUp(self):
        from datetime import date
        from apps.students.models import Student
        from rest_framework_simplejwt.tokens import RefreshToken
        self.client = APIClient()
        self.student = User.objects.create_user(username='graduation-student', email='graduate@example.invalid', password='Synthetic.control!123', role=User.ROLE_STUDENT)
        self.parent = User.objects.create_user(username='graduation-parent', password='Synthetic.parent!123', role=User.ROLE_PARENT)
        self.profile = Student.objects.create(user=self.student, student_id='QA-GRAD-1', date_of_birth=date(2008, 1, 1), gender='F')
        self.refresh = RefreshToken.for_user(self.student)
        self.access = self.refresh.access_token

    def test_untrusted_request_cannot_revoke_access(self):
        response = self.client.post('/api/integration/students/archive-access/', {'identifiers': [self.student.username]}, format='json')
        self.assertEqual(response.status_code, 401)
        self.student.refresh_from_db()
        self.assertTrue(self.student.is_active)

    def test_graduation_revokes_credentials_access_and_refresh_without_deleting_records(self):
        from apps.users.authentication import authenticate_user_identifier
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer
        from apps.students.models import Student
        self.assertIsNotNone(authenticate_user_identifier(self.student.username, 'Synthetic.control!123'))
        response = self.client.post('/api/integration/students/archive-access/', {'identifiers': [self.student.email]}, format='json', HTTP_X_API_KEY='synthetic-graduation-key')
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertFalse(self.student.is_active)
        self.assertFalse(self.profile.is_active)
        self.assertTrue(Student.objects.filter(pk=self.profile.pk).exists())
        self.assertIsNone(authenticate_user_identifier(self.student.username, 'Synthetic.control!123'))
        with self.assertRaises(AuthenticationFailed):
            JWTAuthentication().get_user(self.access)
        with self.assertRaises(AuthenticationFailed):
            TokenRefreshSerializer(data={'refresh': str(self.refresh)}).is_valid(raise_exception=True)
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.is_active)
        self.assertIsNotNone(authenticate_user_identifier(self.parent.username, 'Synthetic.parent!123'))
        repeat = self.client.post('/api/integration/students/archive-access/', {'identifiers': [self.student.email]}, format='json', HTTP_X_API_KEY='synthetic-graduation-key')
        self.assertEqual(repeat.status_code, 200)

    def test_canonical_student_number_revokes_a_legacy_source_identity(self):
        response = self.client.post('/api/integration/students/archive-access/', {'identifiers': [self.profile.student_id, 'NEXUS-GENERATED-CODE']}, format='json', HTTP_X_API_KEY='synthetic-graduation-key')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['archived'], 1)
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)
