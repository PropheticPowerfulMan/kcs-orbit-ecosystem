from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import Role, User
from app.services.analytics_service import analytics_service


router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
):
    return analytics_service.get_dashboard(db)
