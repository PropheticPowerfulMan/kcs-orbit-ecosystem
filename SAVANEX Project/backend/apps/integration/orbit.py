import json
import logging
from pathlib import Path
from threading import Lock
from urllib import error, request
from uuid import uuid4

from decouple import config


logger = logging.getLogger(__name__)

KCS_ORBIT_API_URL = config("KCS_ORBIT_API_URL", default="").rstrip("/")
KCS_ORBIT_API_KEY = config("KCS_ORBIT_API_KEY", default="")
KCS_ORBIT_ORGANIZATION_ID = config("KCS_ORBIT_ORGANIZATION_ID", default="")
KCS_ORBIT_TIMEOUT_SECONDS = config("KCS_ORBIT_TIMEOUT_SECONDS", default=5, cast=int)
OUTBOX_PATH = Path(__file__).resolve().parents[2] / "var" / "orbit-outbox.jsonl"
OUTBOX_FLUSH_BATCH_SIZE = 10

_outbox_lock = Lock()


def orbit_sync_is_enabled() -> bool:
    return bool(KCS_ORBIT_API_URL and KCS_ORBIT_API_KEY and KCS_ORBIT_ORGANIZATION_ID)


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
        url=f"{KCS_ORBIT_API_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": KCS_ORBIT_API_KEY,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=KCS_ORBIT_TIMEOUT_SECONDS) as response:
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


def sync_student(student) -> None:
    if student.parent_id:
        sync_parent(student.parent)

    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": student.student_id,
        "sourceApp": "SAVANEX",
        "occurredAt": student.updated_at.isoformat() if hasattr(student, "updated_at") else None,
        "version": "1.0.0",
        "payload": {
            "firstName": student.user.first_name,
            "lastName": student.user.last_name,
            "gender": student.gender,
            "classExternalId": str(student.current_class_id) if student.current_class_id else None,
            "parentExternalId": str(student.parent_id) if student.parent_id else None,
            "email": student.user.email or None,
            "phone": student.user.phone or None,
            "status": "ACTIVE" if student.is_active else "INACTIVE",
        },
    }
    _post_json("/api/integration/ingest/savanex/students", payload)


def sync_parent(parent) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(parent.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": parent.updated_at.isoformat() if hasattr(parent, "updated_at") else None,
        "version": "1.0.0",
        "payload": {
            "fullName": parent.get_full_name() or parent.username,
            "email": parent.email or None,
            "phone": parent.phone or None,
        },
    }
    _post_json("/api/integration/ingest/savanex/parents", payload)


def sync_teacher(teacher) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": teacher.teacher_id,
        "sourceApp": "SAVANEX",
        "occurredAt": None,
        "version": "1.0.0",
        "payload": {
            "fullName": teacher.user.get_full_name(),
            "email": teacher.user.email or None,
            "phone": teacher.user.phone or None,
            "subject": teacher.specialization or None,
        },
    }
    _post_json("/api/integration/ingest/savanex/teachers", payload)


def sync_class(class_instance) -> None:
    if class_instance.class_teacher_id:
        sync_teacher(class_instance.class_teacher)

    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(class_instance.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": None,
        "version": "1.0.0",
        "payload": {
            "name": class_instance.name,
            "gradeLevel": class_instance.level.name,
            "teacherExternalId": class_instance.class_teacher.teacher_id if class_instance.class_teacher else None,
        },
    }
    _post_json("/api/integration/ingest/savanex/classes", payload)


def sync_grade(grade) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(grade.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": grade.created_at.isoformat() if hasattr(grade, "created_at") else None,
        "version": "1.0.0",
        "payload": {
            "studentExternalId": grade.student.student_id,
            "subject": grade.class_subject.subject.name,
            "score": float(grade.score),
            "maxScore": float(grade.max_score),
            "term": grade.term,
        },
    }
    _post_json("/api/integration/ingest/savanex/grades", payload)


def sync_attendance(attendance) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(attendance.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": attendance.recorded_at.isoformat() if hasattr(attendance, "recorded_at") else None,
        "version": "1.0.0",
        "payload": {
            "studentExternalId": attendance.student.student_id,
            "date": attendance.date.isoformat(),
            "status": attendance.status,
        },
    }
    _post_json("/api/integration/ingest/savanex/attendance", payload)