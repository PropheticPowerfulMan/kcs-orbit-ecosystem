import json
import logging
from datetime import timezone
from pathlib import Path
from threading import Lock
from urllib import error, request
from uuid import uuid4

from app.core.config import settings


logger = logging.getLogger(__name__)
OUTBOX_PATH = Path(__file__).resolve().parents[2] / "var" / "orbit-outbox.jsonl"
OUTBOX_FLUSH_BATCH_SIZE = 10

_outbox_lock = Lock()


def orbit_sync_is_enabled() -> bool:
    return bool(
        settings.kcs_orbit_api_url
        and settings.kcs_orbit_api_key
        and settings.kcs_orbit_organization_id
    )


def _outbox_record(path: str, payload: dict, error_message: str, attempts: int = 0, record_id: str | None = None) -> dict:
    return {
        "id": record_id or str(uuid4()),
        "path": path,
        "payload": payload,
        "attempts": attempts,
        "lastError": error_message,
        "queuedAt": payload.get("occurredAt"),
    }


def _append_outbox(record: dict) -> None:
    OUTBOX_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _outbox_lock:
        with OUTBOX_PATH.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, ensure_ascii=True) + "\n")


def _load_outbox() -> list[dict]:
    if not OUTBOX_PATH.exists():
        return []

    records: list[dict] = []
    with _outbox_lock:
        with OUTBOX_PATH.open("r", encoding="utf-8") as stream:
            for line in stream:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    logger.warning("Orbit outbox contains an unreadable line; skipping it")
    return records


def _write_outbox(records: list[dict]) -> None:
    OUTBOX_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _outbox_lock:
        with OUTBOX_PATH.open("w", encoding="utf-8") as stream:
            for record in records:
                stream.write(json.dumps(record, ensure_ascii=True) + "\n")


def _send_json(path: str, payload: dict) -> tuple[bool, str | None]:
    if not orbit_sync_is_enabled():
        return False, "Missing Orbit configuration"

    req = request.Request(
        url=f"{settings.kcs_orbit_api_url.rstrip('/')}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": settings.kcs_orbit_api_key,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=settings.kcs_orbit_timeout_seconds) as response:
            if response.status not in (200, 201, 202):
                return False, f"Unexpected status {response.status}"
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return False, f"HTTP {exc.code}: {body}"
    except Exception as exc:  # pragma: no cover - defensive integration boundary
        return False, str(exc)

    return True, None


def flush_outbox(max_items: int = OUTBOX_FLUSH_BATCH_SIZE) -> int:
    if not orbit_sync_is_enabled():
        return 0

    records = _load_outbox()
    if not records:
        return 0

    remaining: list[dict] = []
    flushed = 0

    for index, record in enumerate(records):
        if index < max_items:
            success, error_message = _send_json(record["path"], record["payload"])
            if success:
                flushed += 1
                continue

            remaining.append(
                _outbox_record(
                    record["path"],
                    record["payload"],
                    error_message or "Unknown Orbit delivery error",
                    attempts=int(record.get("attempts", 0)) + 1,
                    record_id=record.get("id"),
                )
            )
            continue

        remaining.append(record)

    _write_outbox(remaining)
    return flushed


def _post_json(path: str, payload: dict) -> None:
    flushed = flush_outbox()
    if flushed:
        logger.info("Orbit outbox flushed %s pending event(s)", flushed)

    success, error_message = _send_json(path, payload)
    if success:
        return

    logger.warning("Orbit sync failed for %s: %s", path, error_message)
    _append_outbox(_outbox_record(path, payload, error_message or "Unknown Orbit delivery error"))


def _map_audience(channel: str) -> list[str]:
    normalized = (channel or "all").lower()
    mapping = {
        "all": ["ADMIN", "STAFF", "TEACHER", "PARENT", "STUDENT"],
        "staff": ["ADMIN", "STAFF", "TEACHER"],
        "teachers": ["TEACHER"],
        "parents": ["PARENT"],
        "students": ["STUDENT"],
    }
    return mapping.get(normalized, ["STAFF"])


def _contract_datetime(value) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def sync_announcement(announcement) -> None:
    if not orbit_sync_is_enabled():
        logger.info("Orbit sync skipped: missing EduSync AI configuration")
        return

    payload = {
        "organizationId": settings.kcs_orbit_organization_id,
        "externalId": str(announcement.id),
        "sourceApp": "EDUSYNCAI",
        "occurredAt": _contract_datetime(announcement.created_at),
        "version": "1.0.0",
        "payload": {
            "title": announcement.title,
            "body": announcement.content,
            "audience": _map_audience(announcement.channel),
            "priority": announcement.priority.value.upper(),
            "channel": announcement.channel.upper(),
        },
    }

    _post_json("/api/integration/ingest/edusyncai/announcements", payload)