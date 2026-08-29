from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import User


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
        for api_key in ('nexus-test-key', 'edupay-test-key', 'edusync-test-key'):
            response = self.client.post(
                '/api/integration/authenticate/',
                {'identifier': user.email, 'password': self.password},
                format='json',
                HTTP_X_API_KEY=api_key,
            )
            self.assertEqual(response.status_code, 200)

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
        reset_credentials.assert_called_once_with(parent)
