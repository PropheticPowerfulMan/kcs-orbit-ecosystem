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
                    "students_count": 3,
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
                    "students": [
                        {
                            "id": "stu-k3-1",
                            "displayId": "STU-K3-001",
                            "fullName": "Jeremie Lumbu",
                            "studentNumber": "K3-001",
                            "className": "K3",
                            "parentId": "par-1",
                        },
                        {
                            "id": "stu-k3-2",
                            "displayId": "STU-K3-002",
                            "fullName": "Malia Tshibangu",
                            "studentNumber": "K3-002",
                            "className": "K3 A",
                            "parentId": "par-2",
                        },
                        {
                            "id": "stu-g1-1",
                            "displayId": "STU-G1-001",
                            "fullName": "Noah Banza",
                            "studentNumber": "G1-001",
                            "className": "Grade 1",
                            "parentId": "par-2",
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

    def test_k3_student_list_typo_returns_filtered_students(self):
        intent, confidence = self.engine.detect_intent("donne moi la liste de tous les elves de k3")

        self.assertEqual(intent, "directory_query")
        self.assertGreaterEqual(confidence, 0.8)

        response, actions = self.engine.generate_context_response(
            intent,
            self.context,
            "donne moi la liste de tous les elves de k3",
        )

        self.assertIn("Liste des eleves de K3", response)
        self.assertIn("Jeremie Lumbu", response)
        self.assertIn("Malia Tshibangu", response)
        self.assertNotIn("Noah Banza", response)
        self.assertNotIn("demande est trop ouverte", response)
        self.assertIn("retourner_tableau_repertoire", actions)

    def test_explicit_french_request_answers_in_french(self):
        response, _actions = self.engine.generate_context_response(
            "general_query",
            self.context,
            "parle moi en francais",
        )

        self.assertIn("Voix officielle EduSync AI", response)
        self.assertIn("J'ai compris", response)


if __name__ == "__main__":
    unittest.main()
