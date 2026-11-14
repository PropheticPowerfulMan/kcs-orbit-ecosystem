from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from apps.users.models import User
from apps.teachers.models import Teacher

@override_settings(KCS_NEXUS_AUTH_KEY='qa-policy-key')
class InstitutionalAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.authority = User.objects.create_user(username='qa-root', role=User.ROLE_ADMIN, is_superuser=True)
        self.person = User.objects.create_user(username='qa-teacher', email='teacher@example.invalid', role=User.ROLE_TEACHER, password='UnchangedPassword123!')
        self.hash = self.person.password
    def policy(self, blocked, identifiers=None, key='qa-policy-key'):
        return self.client.post('/api/integration/account-access/', {'identifiers':identifiers or [self.person.email], 'blocked':blocked}, format='json', HTTP_X_API_KEY=key)
    def test_block_restore_is_targeted_and_idempotent(self):
        for flag in [True, True, False, False]:
            response=self.policy(flag)
            self.assertEqual(response.status_code,200,response.data)
            self.person.refresh_from_db()
            self.assertEqual(self.person.is_active,not flag)
            self.assertEqual(self.person.password,self.hash)
            self.authority.refresh_from_db();self.assertTrue(self.authority.is_active)
    def test_inactive_source_account_is_never_accidentally_reactivated(self):
        self.person.is_active=False;self.person.save(update_fields=['is_active'])
        self.assertEqual(self.policy(False).status_code,200)
        self.assertEqual(self.policy(True).status_code,200)
        self.assertEqual(self.policy(False).status_code,200)
        self.person.refresh_from_db();self.assertFalse(self.person.is_active)
    def test_ambiguity_and_source_superuser_are_protected(self):
        User.objects.create_user(username='second',email='second@example.invalid')
        self.assertEqual(self.policy(True,[self.person.email,'second@example.invalid']).status_code,409)
        self.assertEqual(self.policy(True,['qa-root']).status_code,409)
        self.assertEqual(self.policy(True,key='wrong').status_code,401)
    def test_inactive_school_profile_cannot_be_restored(self):
        Teacher.objects.create(user=self.person,teacher_id='QA-T',is_active=False,hire_date='2026-09-01')
        self.assertEqual(self.policy(False).status_code,409)
