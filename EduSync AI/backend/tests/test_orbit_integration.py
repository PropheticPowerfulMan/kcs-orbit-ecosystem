import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

from app.integrations import orbit


class EduSyncOrbitIntegrationTests(unittest.TestCase):
    @patch("app.integrations.orbit._post_json")
    def test_sync_announcement_formats_datetime_and_maps_audience(self, mock_post_json):
        announcement = SimpleNamespace(
            id=99,
            title="Suivi famille Tshisekedi",
            content="Paiement confirme pour Nadia",
            priority=SimpleNamespace(value="urgent"),
            channel="parents",
            created_at=datetime(2026, 5, 5, 5, 28, 44, 961614),
        )

        with patch.object(orbit.settings, "kcs_orbit_api_url", "http://localhost:4500"), \
             patch.object(orbit.settings, "kcs_orbit_api_key", "edusync-test-key"), \
             patch.object(orbit.settings, "kcs_orbit_organization_id", "org-test"):
            orbit.sync_announcement(announcement)

        mock_post_json.assert_called_once()
        path, payload = mock_post_json.call_args.args

        self.assertEqual(path, "/api/integration/ingest/edusyncai/announcements")
        self.assertEqual(payload["organizationId"], "org-test")
        self.assertEqual(payload["payload"]["audience"], ["PARENT"])
        self.assertEqual(payload["payload"]["priority"], "URGENT")
        self.assertTrue(payload["occurredAt"].endswith("Z"))


if __name__ == "__main__":
    unittest.main()