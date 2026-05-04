from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.analytics import ActivityLog


class AnalyticsService:
    def log_event(
        self,
        db: Session,
        event_type: str,
        department: str,
        actor_id: int | None = None,
        latency_ms: int = 0,
    ) -> ActivityLog:
        log = ActivityLog(
            actor_id=actor_id,
            event_type=event_type,
            department=department,
            latency_ms=latency_ms,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    def get_dashboard(self, db: Session) -> dict:
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)

        total_events = db.query(func.count(ActivityLog.id)).scalar() or 0
        avg_latency = db.query(func.avg(ActivityLog.latency_ms)).scalar() or 0
        events_last_24h = (
            db.query(func.count(ActivityLog.id))
            .filter(ActivityLog.created_at >= day_ago)
            .scalar()
            or 0
        )

        department_activity = (
            db.query(ActivityLog.department, func.count(ActivityLog.id))
            .group_by(ActivityLog.department)
            .all()
        )

        return {
            "total_events": total_events,
            "average_response_latency_ms": round(float(avg_latency), 2),
            "events_last_24h": events_last_24h,
            "department_activity": [
                {"department": dep, "events": count} for dep, count in department_activity
            ],
        }


analytics_service = AnalyticsService()
