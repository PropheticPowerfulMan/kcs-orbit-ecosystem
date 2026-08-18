from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.integrations.orbit import fetch_shared_directory, orbit_sync_is_enabled
from app.models.user import User


router = APIRouter(prefix="/directory", tags=["Directory"])


@router.get("/shared")
def shared_directory(_: User = Depends(get_current_user)):
    if orbit_sync_is_enabled():
        return fetch_shared_directory()

    return {
        "source": "local",
        "visibility": "shared-directory",
        "counts": {
            "families": 0,
            "parents": 0,
            "students": 0,
            "teachers": 0,
        },
        "parents": [],
        "students": [],
        "teachers": [],
    }
