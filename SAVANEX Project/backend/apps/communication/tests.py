import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from .services import _normalize_phone, _send_sms_with_africas_talking


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

        result = _send_sms_with_africas_talking('+243812345678', 'Test KCS')

        self.assertEqual(result.status, 'sent')
        self.assertEqual(urlopen.call_count, 2)
        first_payload = urlopen.call_args_list[0].args[0].data.decode()
        second_payload = urlopen.call_args_list[1].args[0].data.decode()
        self.assertIn('from=KCS', first_payload)
        self.assertNotIn('from=', second_payload)

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
