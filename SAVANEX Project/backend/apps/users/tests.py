from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from apps.users.models import User
from apps.users.serializers import UserCreateSerializer
from apps.users.views import UserMeView


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
