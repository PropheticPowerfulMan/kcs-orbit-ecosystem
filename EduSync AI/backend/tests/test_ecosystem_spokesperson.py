import unittest

from app.services.ai.nlp_engine import NLPEngine


class EduSyncSpokespersonTests(unittest.TestCase):
    def setUp(self):
        self.engine = NLPEngine()
        self.context = {
            "department": "Administration",
            "ecosystem_context": {
                "spokesperson_mode": True,
                "ecosystem": {
                    "orbit_connected": False,
                },
                "metrics": {
                    "announcements_total": 4,
                    "urgent_announcements": 1,
                    "pending_workflows": 2,
                    "unread_notifications_for_user": 3,
                    "activity_events_total": 18,
                    "activity_events_last_24h": 5,
                    "average_response_latency_ms": 120,
                },
                "latest_announcements": [{"title": "Reunion parents"}],
                "latest_alerts": [{"title": "Paiement a confirmer"}],
                "shared_directory": {
                    "available": True,
                    "source": "KCS Orbit",
                    "parents_count": 2,
                    "students_count": 0,
                    "teachers_count": 0,
                    "parents": [
                        {
                            "id": "par-1",
                            "displayId": "PAR-001",
                            "fullName": "Parent Alpha",
                            "email": "alpha@example.com",
                            "phone": "+243000001",
                            "studentIds": ["stu-1"],
                        },
                        {
                            "id": "par-2",
                            "displayId": "PAR-002",
                            "fullName": "Parent Beta",
                            "email": "",
                            "phone": "+243000002",
                            "studentIds": ["stu-2", "stu-3"],
                        },
                    ],
                },
            },
        }

    def test_detects_ecosystem_spokesperson_status_request(self):
        intent, confidence = self.engine.detect_intent("Donne l'etat general de tout l'ecosysteme comme porte parole")

        self.assertEqual(intent, "ecosystem_status_query")
        self.assertGreaterEqual(confidence, 0.8)

    def test_response_uses_verified_context_and_truth_limit(self):
        response, actions = self.engine.generate_context_response(
            "ecosystem_status_query",
            self.context,
            "Donne l'etat general de tout l'ecosysteme",
        )

        self.assertIn("Voix officielle EduSync AI", response)
        self.assertIn("4 annonces", response)
        self.assertIn("2 workflows", response)
        self.assertIn("3 notifications", response)
        self.assertIn("je ne peux pas confirmer les notes", response)
        self.assertIn("resumer_etat_ecosysteme", actions)

    def test_parent_list_request_returns_directory_rows_not_finance_workflow(self):
        intent, confidence = self.engine.detect_intent("donne moi la liste de tous les parents de l'ecole")

        self.assertEqual(intent, "directory_query")
        self.assertGreaterEqual(confidence, 0.8)

        response, actions = self.engine.generate_context_response(
            intent,
            self.context,
            "donne moi la liste de tous les parents de l'ecole",
        )

        self.assertIn("Liste des parents de l'ecole", response)
        self.assertIn("Parent Alpha", response)
        self.assertIn("Parent Beta", response)
        self.assertNotIn("ouvrir EduPay", response)
        self.assertIn("retourner_tableau_repertoire", actions)


if __name__ == "__main__":
    unittest.main()
