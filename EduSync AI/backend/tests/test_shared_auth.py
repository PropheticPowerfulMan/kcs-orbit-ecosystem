import io
import json
import unittest
from unittest.mock import patch

from urllib.error import HTTPError

from app.api.routes import auth
from app.models.user import Role


class EduSyncSharedAuthTests(unittest.TestCase):
    def test_map_edupay_role_supports_admin_and_staff_only(self):
        self.assertEqual(auth.map_edupay_role("ADMIN"), Role.ADMIN)
        self.assertEqual(auth.map_edupay_role("ACCOUNTANT"), Role.STAFF)
        self.assertIsNone(auth.map_edupay_role("PARENT"))

    def test_map_savanex_role_supports_admin_teacher_and_employee_only(self):
        self.assertEqual(auth.map_savanex_role("teacher"), Role.TEACHER)
        self.assertEqual(auth.map_savanex_role("employee"), Role.STAFF)
        self.assertEqual(auth.map_savanex_role("admin"), Role.ADMIN)
        self.assertIsNone(auth.map_savanex_role("parent"))
        self.assertIsNone(auth.map_savanex_role("student"))

    @patch.object(auth.settings, "edupay_api_url", "http://localhost:4000")
    @patch.object(auth.settings, "edupay_login_path", "/api/auth/login")
    @patch.object(auth.settings, "edupay_timeout_seconds", 5)
    @patch("app.api.routes.auth.request.urlopen")
    def test_authenticate_with_edupay_maps_admin_payload(self, mock_urlopen):
        payload = {
            "role": "ADMIN",
            "fullName": "Admin User",
            "accessCode": "ACC-ADM-KCS001",
        }
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.read.return_value = json.dumps(payload).encode("utf-8")

        external_user = auth.authenticate_with_edupay("admin@school.com", "password123")

        self.assertEqual(external_user["role"], Role.ADMIN)
        self.assertEqual(external_user["email"], "admin@school.com")
        self.assertEqual(external_user["access_code"], "ACC-ADM-KCS001")
        self.assertEqual(external_user["department"], "Administration")

    @patch.object(auth.settings, "edupay_api_url", "http://localhost:4000")
    @patch.object(auth.settings, "edupay_login_path", "/api/auth/login")
    @patch.object(auth.settings, "edupay_timeout_seconds", 5)
    @patch("app.api.routes.auth.request.urlopen")
    def test_authenticate_with_edupay_rejects_parent_payload(self, mock_urlopen):
        payload = {
            "role": "PARENT",
            "fullName": "Parent User",
            "accessCode": "ACC-PAR-TEST01",
        }
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.read.return_value = json.dumps(payload).encode("utf-8")

        external_user = auth.authenticate_with_edupay("parent@example.com", "password123")

        self.assertIsNone(external_user)

    @patch.object(auth.settings, "edupay_api_url", "http://localhost:4000")
    @patch.object(auth.settings, "edupay_login_path", "/api/auth/login")
    @patch.object(auth.settings, "edupay_timeout_seconds", 5)
    @patch("app.api.routes.auth.request.urlopen")
    def test_authenticate_with_edupay_returns_none_for_invalid_credentials(self, mock_urlopen):
        mock_urlopen.side_effect = HTTPError(
            url="http://localhost:4000/api/auth/login",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=io.BytesIO(b"{}"),
        )

        self.assertIsNone(auth.authenticate_with_edupay("admin@school.com", "wrong-password"))

    @patch.object(auth.settings, "edupay_api_url", "http://localhost:4000")
    @patch.object(auth.settings, "edupay_login_path", "/api/auth/login")
    @patch.object(auth.settings, "edupay_timeout_seconds", 5)
    @patch("app.api.routes.auth.request.urlopen")
    def test_authenticate_with_edupay_raises_on_upstream_failure(self, mock_urlopen):
        mock_urlopen.side_effect = HTTPError(
            url="http://localhost:4000/api/auth/login",
            code=500,
            msg="Server Error",
            hdrs=None,
            fp=io.BytesIO(b"{}"),
        )

        with self.assertRaises(auth.HTTPException) as context:
            auth.authenticate_with_edupay("admin@school.com", "password123")

        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()