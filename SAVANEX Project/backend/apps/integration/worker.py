import logging
import os
import sys
import threading

from django.conf import settings

from apps.integration.orbit import flush_outbox, orbit_sync_is_enabled


logger = logging.getLogger(__name__)

_worker_lock = threading.Lock()
_worker_started = False
_stop_event = threading.Event()


def _should_start_worker() -> bool:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    disabled_commands = {
        "collectstatic",
        "createsuperuser",
        "makemigrations",
        "migrate",
        "shell",
        "test",
    }

    if command in disabled_commands:
        return False

    if command == "runserver":
        return os.environ.get("RUN_MAIN") == "true"

    return True


def _retry_interval_seconds() -> int:
    configured = getattr(settings, "SAVANEX_ORBIT_OUTBOX_RETRY_INTERVAL_SECONDS", 30)
    try:
        return max(5, int(configured))
    except (TypeError, ValueError):
        return 30


def _flush_once() -> None:
    flushed = flush_outbox()
    if flushed:
        logger.info("Orbit outbox worker flushed %s pending event(s)", flushed)


def _worker_loop() -> None:
    interval = _retry_interval_seconds()
    while not _stop_event.wait(interval):
        try:
            _flush_once()
        except Exception:
            logger.exception("Orbit outbox worker failed")


def start_outbox_worker() -> None:
    global _worker_started

    if not orbit_sync_is_enabled() or not _should_start_worker():
        return

    with _worker_lock:
        if _worker_started:
            return

        try:
            _flush_once()
        except Exception:
            logger.exception("Initial Orbit outbox flush failed")

        thread = threading.Thread(
            target=_worker_loop,
            name="savanex-orbit-outbox",
            daemon=True,
        )
        thread.start()
        _worker_started = True