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

class NotificationOrderingTests(SimpleTestCase):
    @patch('apps.communication.services._send_user_email')
    @patch('apps.communication.services._send_user_sms')
    def test_sms_starts_before_email_without_changing_response_contract(self, send_sms, send_email):
        from .services import DeliveryResult, deliver_direct_parent_contact

        calls = []
        send_sms.side_effect = lambda *_args: calls.append('sms') or DeliveryResult('sms', 'sent')
        send_email.side_effect = lambda *_args: calls.append('email') or DeliveryResult('email', 'sent')

        results = deliver_direct_parent_contact(
            email='parent@example.com',
            phone='+243812345678',
            subject='Test',
            body='Test',
        )

        self.assertEqual(calls, ['sms', 'email'])
        self.assertEqual([result.channel for result in results], ['email', 'sms'])
