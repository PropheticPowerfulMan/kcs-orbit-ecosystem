import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from urllib.parse import quote
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


def _get_json(path: str) -> dict:
    if not orbit_sync_is_enabled():
        raise RuntimeError("Missing Orbit configuration")

    req = request.Request(
        url=f"{KCS_ORBIT_API_URL}{path}",
        headers={
            "x-api-key": KCS_ORBIT_API_KEY,
            "x-app-slug": "SAVANEX",
        },
        method="GET",
    )

    with request.urlopen(req, timeout=KCS_ORBIT_TIMEOUT_SECONDS) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"Unexpected status {response.status}")
        return json.loads(response.read().decode("utf-8"))


def _request_json(method: str, path: str, payload: dict | None = None) -> dict:
    if not orbit_sync_is_enabled():
        raise RuntimeError("Missing Orbit configuration")

    req = request.Request(
        url=f"{KCS_ORBIT_API_URL}{path}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={
            "Content-Type": "application/json",
            "x-api-key": KCS_ORBIT_API_KEY,
            "x-app-slug": "SAVANEX",
        },
        method=method,
    )

    with request.urlopen(req, timeout=KCS_ORBIT_TIMEOUT_SECONDS) as response:
        body = response.read().decode("utf-8")
        if response.status not in (200, 201):
            raise RuntimeError(f"Unexpected status {response.status}")
        return json.loads(body) if body else {}


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


def _contract_datetime(value: datetime | None) -> str:
    if value is None:
        value = datetime.now(timezone.utc)
    elif value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _compact(mapping: dict) -> dict:
    return {key: value for key, value in mapping.items() if value is not None}


def sync_student(student) -> None:
    if student.parent_id:
        sync_parent(student.parent)

    parent_external_id = str(student.parent_id) if student.parent_id else None
    metadata = {
        "parentExternalId": parent_external_id,
        "parentUsername": student.parent.username if student.parent_id else None,
    }

    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": student.student_id,
        "sourceApp": "SAVANEX",
        "occurredAt": _contract_datetime(getattr(student, "updated_at", None)),
        "version": "1.0.0",
        "metadata": metadata,
        "payload": _compact({
            "firstName": student.user.first_name,
            "lastName": student.user.last_name,
            "gender": student.gender,
            "classExternalId": str(student.current_class_id) if student.current_class_id else None,
            "parentExternalId": parent_external_id,
            "email": student.user.email or None,
            "phone": student.user.phone or None,
            "status": "ACTIVE" if student.is_active else "INACTIVE",
        }),
    }
    _post_json("/api/integration/ingest/savanex/students", payload)


def sync_parent(parent) -> None:
    metadata = {
        "childrenExternalIds": list(parent.children.filter(is_active=True).values_list("student_id", flat=True)),
        "username": parent.username,
    }

    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(parent.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": _contract_datetime(getattr(parent, "updated_at", None)),
        "version": "1.0.0",
        "metadata": metadata,
        "payload": _compact({
            "fullName": parent.get_full_name() or parent.username,
            "email": parent.email or None,
            "phone": parent.phone or None,
        }),
    }
    _post_json("/api/integration/ingest/savanex/parents", payload)


def sync_teacher(teacher) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": teacher.teacher_id,
        "sourceApp": "SAVANEX",
        "occurredAt": _contract_datetime(getattr(teacher, "updated_at", None)),
        "version": "1.0.0",
        "payload": _compact({
            "fullName": teacher.user.get_full_name(),
            "email": teacher.user.email or None,
            "phone": teacher.user.phone or None,
            "employeeId": teacher.employee_id,
            "employeeType": teacher.employee_type,
            "department": teacher.department or None,
            "jobTitle": teacher.job_title or None,
            "contractType": teacher.contract_type or None,
            "employmentStatus": teacher.employment_status,
            "workLocation": teacher.work_location or None,
            "workEmail": teacher.work_email or None,
            "supervisorName": teacher.supervisor_name or None,
            "salaryGrade": teacher.salary_grade or None,
            "payFrequency": teacher.pay_frequency or None,
            "subject": teacher.specialization or None,
        }),
    }
    _post_json("/api/integration/ingest/savanex/teachers", payload)


def sync_class(class_instance) -> None:
    if class_instance.class_teacher_id:
        sync_teacher(class_instance.class_teacher)

    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(class_instance.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": _contract_datetime(getattr(class_instance, "updated_at", None)),
        "version": "1.0.0",
        "payload": _compact({
            "name": class_instance.name,
            "gradeLevel": class_instance.level.name,
            "teacherExternalId": class_instance.class_teacher.teacher_id if class_instance.class_teacher else None,
        }),
    }
    _post_json("/api/integration/ingest/savanex/classes", payload)


def sync_grade(grade) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(grade.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": _contract_datetime(getattr(grade, "created_at", None)),
        "version": "1.0.0",
        "payload": _compact({
            "studentExternalId": grade.student.student_id,
            "subject": grade.class_subject.subject.name,
            "score": float(grade.score),
            "maxScore": float(grade.max_score),
            "term": grade.term,
        }),
    }
    _post_json("/api/integration/ingest/savanex/grades", payload)


def sync_attendance(attendance) -> None:
    payload = {
        "organizationId": KCS_ORBIT_ORGANIZATION_ID,
        "externalId": str(attendance.pk),
        "sourceApp": "SAVANEX",
        "occurredAt": _contract_datetime(getattr(attendance, "recorded_at", None)),
        "version": "1.0.0",
        "payload": _compact({
            "studentExternalId": attendance.student.student_id,
            "date": _contract_datetime(attendance.date),
            "status": attendance.status,
        }),
    }
    _post_json("/api/integration/ingest/savanex/attendance", payload)


def fetch_shared_directory() -> dict:
    return _get_json(
        f"/api/integration/read/shared-directory?organizationId={quote(KCS_ORBIT_ORGANIZATION_ID)}"
    )


def create_registry_entity(entity_type: str, payload: dict) -> dict:
    return _request_json(
        "POST",
        f"/api/integration/registry/{quote(entity_type)}",
        {**payload, "organizationId": KCS_ORBIT_ORGANIZATION_ID},
    )


def delete_registry_entity(entity_type: str, identifier: str, identifier_type: str = "orbitId") -> dict:
    return _request_json(
        "DELETE",
        f"/api/integration/registry/{quote(entity_type)}/{quote(identifier)}?organizationId={quote(KCS_ORBIT_ORGANIZATION_ID)}&identifierType={quote(identifier_type)}",
    )


def delete_student(student) -> None:
    try:
        delete_registry_entity("student", student.student_id, "externalId")
    except Exception as exc:  # pragma: no cover - defensive integration boundary
        logger.warning("Orbit student delete failed for %s: %s", student.student_id, exc)


def delete_parent(parent) -> None:
    try:
        delete_registry_entity("parent", str(parent.pk), "externalId")
    except Exception as exc:  # pragma: no cover - defensive integration boundary
        logger.warning("Orbit parent delete failed for %s: %s", parent.pk, exc)
