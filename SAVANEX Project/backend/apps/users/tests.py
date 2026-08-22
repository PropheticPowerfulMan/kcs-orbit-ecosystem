from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from apps.users.models import User
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
            role=User.ROLE_PARENT,
            access_code='ACC-PAR-LOGIN1',
        )
        client = APIClient()

        response = client.post('/api/auth/login/', {
            'username': user.access_code,
            'password': password,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], user.id)
        self.assertEqual(response.data['user']['access_code'], user.access_code)

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
