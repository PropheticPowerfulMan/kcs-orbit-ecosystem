from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import require_roles
from app.integrations.orbit import create_registry_entity, delete_registry_entity, orbit_sync_is_enabled
from app.models.user import Role, User


class RegistryEntityPayload(BaseModel):
    payload: dict


router = APIRouter(prefix="/registry", tags=["Registry"])


@router.post("/entities/{entity_type}")
def create_entity(
    entity_type: str,
    request_body: RegistryEntityPayload,
    _: User = Depends(require_roles(Role.ADMIN)),
):
    if not orbit_sync_is_enabled():
      raise HTTPException(status_code=409, detail="Orbit registry mode must be enabled to create shared entities from EduSync AI")

    return create_registry_entity(entity_type, request_body.payload)


@router.delete("/entities/{entity_type}/{identifier}")
def delete_entity(
    entity_type: str,
    identifier: str,
    identifier_type: str = "orbitId",
    _: User = Depends(require_roles(Role.ADMIN)),
):
    if not orbit_sync_is_enabled():
      raise HTTPException(status_code=409, detail="Orbit registry mode must be enabled to delete shared entities from EduSync AI")

    return delete_registry_entity(entity_type, identifier, identifier_type)