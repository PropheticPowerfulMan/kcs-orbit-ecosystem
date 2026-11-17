import tempfile
from pathlib import Path
from unittest.mock import patch
from django.db import transaction
from django.test import TransactionTestCase
from apps.integration import orbit, worker


class DurableOutboxTests(TransactionTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "outbox.jsonl"

    def test_request_enqueues_only_after_commit_and_never_sends_http(self):
        with patch.object(orbit, "OUTBOX_PATH", self.path), patch.object(orbit, "_running_tests", return_value=False), patch.object(orbit, "_send_json") as send:
            with self.assertRaises(ValueError):
                with transaction.atomic():
                    orbit._post_json("/qa", {"occurredAt": "2026-11-17T00:00:00Z"})
                    raise ValueError("rollback")
            self.assertFalse(self.path.exists())
            with transaction.atomic():
                orbit._post_json("/qa", {"occurredAt": "2026-11-17T00:00:00Z"})
                self.assertFalse(self.path.exists())
            self.assertEqual(len(orbit._load_outbox()), 1)
            send.assert_not_called()

    def test_new_event_arriving_during_http_is_not_lost(self):
        with patch.object(orbit, "OUTBOX_PATH", self.path), patch.object(orbit, "orbit_sync_is_enabled", return_value=True):
            old = orbit._outbox_record("/old", {}, "")
            new = orbit._outbox_record("/new", {}, "")
            orbit._append_outbox(old)
            def send(*_):
                orbit._append_outbox(new)
                return True, None
            with patch.object(orbit, "_send_json", side_effect=send):
                self.assertEqual(orbit.flush_outbox(), 1)
            self.assertEqual(orbit._load_outbox(), [new])

    def test_retry_and_corrupt_lines_are_retained(self):
        with patch.object(orbit, "OUTBOX_PATH", self.path), patch.object(orbit, "orbit_sync_is_enabled", return_value=True), patch.object(orbit, "_send_json", return_value=(False, "timeout")):
            orbit._append_outbox(orbit._outbox_record("/retry", {}, ""))
            with self.path.open("a") as stream:
                stream.write("{unreadable}\n")
            self.assertEqual(orbit.flush_outbox(), 0)
            rows = orbit._load_outbox()
            self.assertEqual(rows[0]["attempts"], 1)
            self.assertIn("{unreadable}", self.path.read_text())

    def test_worker_startup_never_flushes_on_the_request_thread(self):
        with patch.object(worker, "orbit_sync_is_enabled", return_value=True), patch.object(worker, "_should_start_worker", return_value=True), patch.object(worker, "_worker_started", False), patch.object(worker, "_flush_once") as flush, patch.object(worker.threading, "Thread") as thread:
            worker.start_outbox_worker()
            thread.return_value.start.assert_called_once()
            flush.assert_not_called()
