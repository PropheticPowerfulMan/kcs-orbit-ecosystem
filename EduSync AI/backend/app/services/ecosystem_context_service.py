from sqlalchemy import func
from sqlalchemy.orm import Session

from app.integrations.orbit import fetch_shared_directory, orbit_sync_is_enabled
from app.models.message import Announcement, MessagePriority
from app.models.notification import Notification
from app.models.user import User
from app.models.workflow import WorkflowItem, WorkflowStatus
from app.services.analytics_service import analytics_service


class EcosystemContextService:
    """Build the factual brief EduSync AI uses as ecosystem spokesperson."""

    def build(self, db: Session, current_user: User) -> dict:
        announcements_total = db.query(func.count(Announcement.id)).scalar() or 0
        urgent_announcements = (
            db.query(func.count(Announcement.id))
            .filter(Announcement.priority == MessagePriority.URGENT)
            .scalar()
            or 0
        )
        pending_workflows = (
            db.query(func.count(WorkflowItem.id))
            .filter(WorkflowItem.status == WorkflowStatus.PENDING)
            .scalar()
            or 0
        )
        unread_notifications = (
            db.query(func.count(Notification.id))
            .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
            .scalar()
            or 0
        )

        latest_announcements = (
            db.query(Announcement)
            .order_by(Announcement.created_at.desc())
            .limit(3)
            .all()
        )
        latest_alerts = (
            db.query(Notification)
            .filter(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(3)
            .all()
        )

        directory = self._safe_directory()
        analytics = analytics_service.get_dashboard(db)

        return {
            "spokesperson_mode": True,
            "truth_policy": (
                "Use only facts present in this context or explicitly say what data is missing. "
                "Do not invent students, payments, grades, or statistics."
            ),
            "actor": {
                "id": current_user.id,
                "name": current_user.full_name,
                "role": current_user.role.value,
                "department": current_user.department,
            },
            "ecosystem": {
                "applications": ["SAVANEX", "EduPay", "KCS Nexus", "EduSync AI", "KCS Orbit"],
                "edusync_role": "official communication voice and operational spokesperson",
                "orbit_connected": orbit_sync_is_enabled(),
                "shared_directory_available": bool(directory.get("available")),
            },
            "metrics": {
                "announcements_total": announcements_total,
                "urgent_announcements": urgent_announcements,
                "pending_workflows": pending_workflows,
                "unread_notifications_for_user": unread_notifications,
                "activity_events_total": analytics["total_events"],
                "activity_events_last_24h": analytics["events_last_24h"],
                "average_response_latency_ms": analytics["average_response_latency_ms"],
            },
            "latest_announcements": [
                {
                    "title": item.title,
                    "priority": item.priority.value,
                    "channel": item.channel,
                    "status": item.status.value,
                }
                for item in latest_announcements
            ],
            "latest_alerts": [
                {
                    "title": item.title,
                    "priority": item.priority.value,
                    "read": item.is_read,
                }
                for item in latest_alerts
            ],
            "shared_directory": directory,
        }

    def _safe_directory(self) -> dict:
        if not orbit_sync_is_enabled():
            return {
                "available": False,
                "source": "KCS Orbit",
                "reason": "Orbit configuration is missing",
                "parents_count": None,
                "students_count": None,
                "teachers_count": None,
            }

        try:
            payload = fetch_shared_directory()
        except Exception as exc:
            return {
                "available": False,
                "source": "KCS Orbit",
                "reason": str(exc),
                "parents_count": None,
                "students_count": None,
                "teachers_count": None,
            }

        return {
            "available": True,
            "source": "KCS Orbit",
            "parents_count": len(payload.get("parents", [])),
            "students_count": len(payload.get("students", [])),
            "teachers_count": len(payload.get("teachers", [])),
        }


ecosystem_context_service = EcosystemContextService()
