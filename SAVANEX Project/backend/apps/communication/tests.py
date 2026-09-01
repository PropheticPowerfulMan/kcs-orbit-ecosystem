import json
import urllib.parse
import unicodedata
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from .services import _normalize_phone, _send_sms_with_africas_talking, _short_sms


class SmsDeliveryTests(SimpleTestCase):
    def test_normalizes_congolese_phone_numbers(self):
        self.assertEqual(_normalize_phone('081 234 5678'), '+243812345678')
        self.assertEqual(_normalize_phone('243812345678'), '+243812345678')
        self.assertEqual(_normalize_phone('+243 812 345 678'), '+243812345678')

    @override_settings(
        AFRICASTALKING_API_URL='https://api.africastalking.com/version1/messaging',
        AFRICASTALKING_API_KEY='test-key',
        AFRICASTALKING_USERNAME='test-user',
        AFRICASTALKING_SENDER='KCS',
    )
    @patch('apps.communication.services.urllib.request.urlopen')
    def test_retries_without_rejected_sender_id(self, urlopen):
        rejected = MagicMock()
        rejected.__enter__.return_value.status = 201
        rejected.__enter__.return_value.read.return_value = json.dumps({
            'SMSMessageData': {'Recipients': [{'status': 'InvalidSenderId', 'statusCode': '403'}]},
        }).encode()
        accepted = MagicMock()
        accepted.__enter__.return_value.status = 201
        accepted.__enter__.return_value.read.return_value = json.dumps({
            'SMSMessageData': {'Recipients': [{'status': 'Success', 'statusCode': '101'}]},
        }).encode()
        urlopen.side_effect = [rejected, accepted]

        result = _send_sms_with_africas_talking('+243812345678', 'Élève prêt : accès sécurisé à l’école.')

        self.assertEqual(result.status, 'sent')
        self.assertEqual(urlopen.call_count, 2)
        first_payload = urlopen.call_args_list[0].args[0].data.decode()
        second_payload = urlopen.call_args_list[1].args[0].data.decode()
        self.assertIn('from=KCS', first_payload)
        self.assertNotIn('from=', second_payload)
        decoded_payload = urllib.parse.parse_qs(first_payload)
        self.assertEqual(decoded_payload['message'][0], 'Élève prêt : accès sécurisé à l’école.')
    def test_sms_keeps_structure_accents_and_complete_credentials(self):
        body = (
            'Bonjour Jonathan,\n\n'
            'Identifiant : jonathan.lokala@ourkcs.org.\n'
            'Code d’accès : ACC-TCH-776971.\n'
            'Mot de passe temporaire : KCS-684032.\n\n'
            'Ce mot de passe doit être changé à la première connexion.'
        )
        message = _short_sms('Vos accès institutionnels KCS sont actifs', body)
        self.assertIn('\n\nIdentifiant :', message)
        self.assertIn('Vos accès institutionnels', message)
        self.assertIn('doit être changé à la première connexion', message)
        self.assertEqual(message, unicodedata.normalize('NFC', message))
        self.assertNotIn('Ã', message)
        self.assertNotIn('Â', message)

class ManualAdminFormattingTests(SimpleTestCase):
    def test_manual_superadmin_sms_has_no_application_header(self):
        message = _short_sms('Réunion parents', 'Bonjour, rendez-vous à 14 h.', branded=False)
        self.assertEqual(message, 'Réunion parents\n\nBonjour, rendez-vous à 14 h.')
        self.assertNotIn('SAVANEX', message)

    @patch('apps.communication.services._send_user_email')
    @patch('apps.communication.services._send_user_sms')
    def test_direct_parent_delivery_disables_branding(self, send_sms, send_email):
        from .services import DeliveryResult, deliver_direct_parent_contact
        send_sms.return_value = DeliveryResult('sms', 'sent')
        send_email.return_value = DeliveryResult('email', 'sent')
        deliver_direct_parent_contact(name='Parent', email='parent@example.com', phone='+243810000000', subject='Sujet', body='Texte', branded=False)
        self.assertFalse(send_sms.call_args.kwargs['branded'])
        self.assertFalse(send_email.call_args.kwargs['branded'])


class NotificationOrderingTests(SimpleTestCase):
    @patch('apps.communication.services._send_user_email')
    @patch('apps.communication.services._send_user_sms')
    def test_sms_starts_before_email_without_changing_response_contract(self, send_sms, send_email):
        from .services import DeliveryResult, deliver_direct_parent_contact

        calls = []
        send_sms.side_effect = lambda *_args, **_kwargs: calls.append('sms') or DeliveryResult('sms', 'sent')
        send_email.side_effect = lambda *_args, **_kwargs: calls.append('email') or DeliveryResult('email', 'sent')

        results = deliver_direct_parent_contact(
            email='parent@example.com',
            phone='+243812345678',
            subject='Test',
            body='Test',
        )

        self.assertEqual(calls, ['sms', 'email'])
        self.assertEqual([result.channel for result in results], ['email', 'sms'])


from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from .models import Message, Notification


class InternalMessagingApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin-msg', password='test', role=User.ROLE_ADMIN)
        self.teacher = User.objects.create_user(username='teacher-msg', password='test', role=User.ROLE_TEACHER)
        self.parent = User.objects.create_user(username='parent-msg', password='test', role=User.ROLE_PARENT)
        self.student = User.objects.create_user(username='student-msg', password='test', role=User.ROLE_STUDENT)
        self.other_parent = User.objects.create_user(username='other-parent-msg', password='test', role=User.ROLE_PARENT)

    @patch('apps.communication.views.deliver_user_communication')
    def test_parent_can_message_staff_and_notification_is_persisted(self, deliver):
        deliver.return_value = []
        self.client.force_authenticate(self.parent)
        response = self.client.post('/api/communication/messages/', {
            'receiver': self.teacher.pk, 'subject': 'Question', 'body': 'Bonjour',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get()
        self.assertEqual(message.sender, self.parent)
        self.assertEqual(message.receiver, self.teacher)
        self.assertTrue(Notification.objects.filter(user=self.teacher, notif_type=Notification.TYPE_MESSAGE, title='Question').exists())

    def test_parent_cannot_message_another_parent_or_student(self):
        self.client.force_authenticate(self.parent)
        for receiver in (self.other_parent, self.student):
            response = self.client.post('/api/communication/messages/', {
                'receiver': receiver.pk, 'subject': 'Interdit', 'body': 'Test',
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Message.objects.count(), 0)

    def test_message_inbox_and_read_state_are_private(self):
        message = Message.objects.create(sender=self.admin, receiver=self.parent, subject='Prive', body='Contenu prive')
        self.client.force_authenticate(self.other_parent)
        self.assertEqual(self.client.post(f'/api/communication/messages/{message.pk}/read/').status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get('/api/communication/messages/?box=all').json(), [])
        self.client.force_authenticate(self.parent)
        response = self.client.post(f'/api/communication/messages/{message.pk}/read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        message.refresh_from_db()
        self.assertTrue(message.is_read)

    @patch('apps.communication.views.deliver_user_communication', side_effect=RuntimeError('provider unavailable'))
    def test_external_delivery_failure_does_not_rollback_internal_message(self, _deliver):
        self.client.force_authenticate(self.teacher)
        response = self.client.post('/api/communication/messages/', {
            'receiver': self.parent.pk, 'subject': 'Message durable', 'body': 'Le message interne doit rester disponible.',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['delivery'][0]['status'], 'failed')
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.parent).count(), 1)

    def test_contact_directory_respects_role_policy(self):
        self.client.force_authenticate(self.parent)
        response = self.client.get('/api/communication/messages/contacts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        roles = {row['role'] for row in response.json()}
        self.assertTrue(roles <= {User.ROLE_ADMIN, User.ROLE_EMPLOYEE, User.ROLE_TEACHER})
        self.assertNotIn(User.ROLE_PARENT, roles)
        self.assertNotIn(User.ROLE_STUDENT, roles)
