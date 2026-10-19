"""
State router: provides endpoints for snapshot retrieval and state queries.
"""
from fastapi import APIRouter
from app.models import StateSnapshot
from app.state import state_store

router = APIRouter(prefix="/api/state", tags=["State"])


@router.get("", response_model=StateSnapshot, summary="Get full operational state snapshot")
async def get_state() -> StateSnapshot:
    """
    Returns the complete in-memory tactical state snapshot including:
    - Weapons inventory & live stocks
    - Aircraft fleet readiness & fuel/loadout
    - Airbases & runway status
    - Pilot roster & fatigue metrics
    - Threat zones
    - Mission targets
    - Active deployed missions
    - Event audit logs
    """
    return await state_store.get_snapshot_async()
