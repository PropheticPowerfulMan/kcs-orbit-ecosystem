from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from apps.users.models import InstitutionalEmailAudit, User
from apps.users.serializers import UserCreateSerializer
from apps.users.views import UserMeView, reset_user_access_credentials


class UserAccessCodeTests(TestCase):
    def test_create_serializer_generates_access_code(self):
        serializer = UserCreateSerializer(
            data={
                'first_name': 'Rachel',
                'last_name': 'Kabongo',
                'email': 'rachel.kabongo@example.com',
                'role': User.ROLE_PARENT,
                'password': 'ParentPass123!',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertTrue(user.access_code.startswith('ACC-PAR-'))

    def test_login_accepts_access_code(self):
        password = 'ParentPass123!'
        user = User.objects.create_user(
            username='parent-access-login',
            email='parent.access.login@example.com',
            password=password,
            first_name='Rachel',
            last_name='Kabongo',
            role=User.ROLE_ADMIN,
            access_code='ACC-ADM-LOGIN1',
        )
        client = APIClient()

        response = client.post('/api/auth/login/', {
            'username': user.access_code,
            'password': password,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], user.id)
        self.assertEqual(response.data['user']['access_code'], user.access_code)

    def test_teacher_login_accepts_all_institutional_identifiers(self):
        password = 'TeacherPass123!'
        user = User.objects.create_user(
            username='teacher-institutional-login',
            email='teacher.login@ourkcs.org',
            password=password,
            first_name='Jonathan',
            last_name='Lokala',
            role=User.ROLE_TEACHER,
            access_code='ACC-TCH-LOGIN1',
            kcs_card_id='KCS-TCH-LOGIN1',
        )
        client = APIClient()

        for identifier in (user.username, user.email, user.access_code, user.kcs_card_id):
            with self.subTest(identifier=identifier):
                response = client.post('/api/auth/login/', {
                    'username': identifier,
                    'password': password,
                }, format='json')

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['user']['id'], user.id)

    @patch('apps.users.views.deliver_direct_parent_contact', return_value=[])
    @patch('apps.users.views.sync_parent')
    def test_reset_access_invalidates_old_password_and_preserves_access_code(self, _sync_parent, _deliver):
        old_password = 'ParentPass123!'
        user = User.objects.create_user(
            username='parent-reset-access',
            email='parent.reset.access@example.com',
            password=old_password,
            first_name='Rachel',
            last_name='Kabongo',
            role=User.ROLE_PARENT,
            access_code='ACC-PAR-RESET1',
        )

        credentials = reset_user_access_credentials(user)
        user.refresh_from_db()

        self.assertFalse(user.check_password(old_password))
        self.assertTrue(user.check_password(credentials['temporaryPassword']))
        self.assertEqual(credentials['accessCode'], 'ACC-PAR-RESET1')
        self.assertTrue(user.must_change_password)

    @patch('apps.users.views._reset_side_effect_executor.submit')
    @patch('apps.users.views.deliver_direct_parent_contact')
    @patch('apps.users.views.sync_parent')
    def test_deferred_reset_returns_credentials_before_sync_and_delivery(self, sync_parent_mock, delivery_mock, submit_mock):
        user = User.objects.create_user(
            username='parent-fast-reset',
            email='parent.fast.reset@example.com',
            password='ParentPass123!',
            role=User.ROLE_PARENT,
            access_code='ACC-PAR-FAST1',
        )

        credentials = reset_user_access_credentials(user, defer_side_effects=True)

        self.assertTrue(credentials['temporaryPassword'])
        self.assertEqual(credentials['accessCode'], 'ACC-PAR-FAST1')
        self.assertEqual(credentials['delivery'][0]['status'], 'queued')
        submit_mock.assert_called_once()
        sync_parent_mock.assert_not_called()
        delivery_mock.assert_not_called()

    def test_current_user_can_update_access_code(self):
        factory = APIRequestFactory()
        user = User.objects.create_user(
            username='parent-update-access',
            email='parent.update.access@example.com',
            password='ParentPass123!',
            first_name='Rachel',
            last_name='Kabongo',
            role=User.ROLE_PARENT,
        )

        request = factory.patch('/api/users/me/', {'access_code': 'ACC-PAR-CUSTOM'}, format='json')
        force_authenticate(request, user=user)
        response = UserMeView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.access_code, 'ACC-PAR-CUSTOM')
class SchoolEmailGenerationTests(TestCase):
    def create_entity(self, *, first_name='Élodie', middle_name='', last_name='Mbuyi-Kabongo', role=User.ROLE_STUDENT):
        serializer = UserCreateSerializer(data={
            'first_name': first_name,
            'middle_name': middle_name,
            'last_name': last_name,
            'email': 'adresse.personnelle@example.com',
            'role': role,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_generates_short_school_email_and_ignores_submitted_personal_email(self):
        user = self.create_entity()
        self.assertEqual(user.email, 'elodie.mbuyikabongo@ourkcs.org')

    def test_uses_middle_initial_then_numeric_suffix_to_guarantee_uniqueness(self):
        first = self.create_entity()
        second = self.create_entity(middle_name='Grâce')
        third = self.create_entity()

        self.assertEqual(first.email, 'elodie.mbuyikabongo@ourkcs.org')
        self.assertEqual(second.email, 'elodie.g.mbuyikabongo@ourkcs.org')
        self.assertEqual(third.email, 'elodie.mbuyikabongo2@ourkcs.org')
        self.assertEqual(User.objects.filter(email__iendswith='@ourkcs.org').count(), 3)

    def test_generates_email_for_employee_roles(self):
        employee = self.create_entity(first_name='Paul', last_name='Ilunga', role=User.ROLE_EMPLOYEE)
        teacher = self.create_entity(first_name='Paul', middle_name='Alain', last_name='Ilunga', role=User.ROLE_TEACHER)

        self.assertEqual(employee.email, 'paul.ilunga@ourkcs.org')
        self.assertEqual(teacher.email, 'paul.a.ilunga@ourkcs.org')

class PasswordRecoveryChannelTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='recovery-channel-user',
            email='recovery.channel@example.com',
            password='ParentPass123!',
            phone='+243816300058',
            role=User.ROLE_PARENT,
        )

    @patch('apps.users.views.send_branded_email')
    @patch('apps.users.views._send_user_sms')
    def test_sms_channel_uses_sms_only(self, send_sms, send_email):
        send_sms.return_value.status = 'sent'
        response = self.client.post('/api/auth/forgot-password/', {
            'email': self.user.email,
            'channel': 'sms',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        send_sms.assert_called_once()
        send_email.assert_not_called()
        self.user.refresh_from_db()
        self.assertTrue(self.user.must_change_password)
        self.assertFalse(self.user.check_password('ParentPass123!'))

    @patch('apps.users.views.send_branded_email')
    @patch('apps.users.views._send_user_sms')
    def test_email_channel_uses_email_only(self, send_sms, send_email):
        send_email.return_value = 1
        response = self.client.post('/api/auth/forgot-password/', {
            'email': self.user.email,
            'channel': 'email',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        send_email.assert_called_once()
        send_sms.assert_not_called()
        self.user.refresh_from_db()
        self.assertTrue(self.user.must_change_password)
        self.assertFalse(self.user.check_password('ParentPass123!'))

class LegacyInstitutionalEmailTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_trusted_student_and_staff_import_preserves_email(self):
        for role, email in [(User.ROLE_STUDENT, 'student.old@kinshasachristianschool.org'), (User.ROLE_EMPLOYEE, 'staff.old@kinshasachristianschool.org')]:
            serializer = UserCreateSerializer(data={'first_name':'Legacy','last_name':role,'email':email,'role':role}, context={'legacy_import':True})
            self.assertTrue(serializer.is_valid(), serializer.errors)
            self.assertEqual(serializer.save().email, email)

    def test_trusted_import_generates_when_email_missing(self):
        serializer = UserCreateSerializer(data={'first_name':'Generated','last_name':'Student','role':User.ROLE_STUDENT}, context={'legacy_import':True})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertTrue(serializer.save().email.endswith('@ourkcs.org'))

    @patch('apps.users.views.sync_student')
    def test_admin_can_change_email_with_audit_and_duplicate_is_rejected(self, _sync):
        admin=User.objects.create_user(username='legacy-admin',email='admin@ourkcs.org',password='AdminPass123!',role=User.ROLE_ADMIN)
        student=User.objects.create_user(username='legacy-student',email='old@ourkcs.org',password='StudentPass123!',role=User.ROLE_STUDENT)
        other=User.objects.create_user(username='other-student',email='taken@ourkcs.org',password='StudentPass123!',role=User.ROLE_STUDENT)
        self.client.force_authenticate(admin)
        response=self.client.patch(f'/api/users/{student.pk}/institutional-email/',{'institutionalEmail':'historic@kinshasachristianschool.org','reason':'QuickSchool migration'},format='json')
        self.assertEqual(response.status_code,200)
        student.refresh_from_db(); self.assertEqual(student.email,'historic@kinshasachristianschool.org')
        audit=InstitutionalEmailAudit.objects.get(user=student); self.assertEqual(audit.old_value,'old@ourkcs.org'); self.assertEqual(audit.changed_by,admin)
        conflict=self.client.patch(f'/api/users/{student.pk}/institutional-email/',{'institutionalEmail':other.email,'reason':'test conflict'},format='json')
        self.assertEqual(conflict.status_code,409)

    def test_non_admin_forbidden(self):
        student=User.objects.create_user(username='ordinary',email='ordinary@ourkcs.org',password='StudentPass123!',role=User.ROLE_STUDENT)
        self.client.force_authenticate(student)
        response=self.client.patch(f'/api/users/{student.pk}/institutional-email/',{'institutionalEmail':'new@ourkcs.org','reason':'no permission'},format='json')
        self.assertEqual(response.status_code,403)
