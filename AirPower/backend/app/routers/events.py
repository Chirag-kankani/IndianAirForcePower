"""
Events Router: Trigger Tactical Theatre Events and Reset Scenarios.
Broadcasts real-time updates to all connected dashboards via WebSockets.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status

from app.events import replan_logic
from app.models import (
    EventLogEntry,
    EventType,
    StateSnapshot,
    TriggerEventRequest,
    TriggerEventResponse,
)
from app.replay_service import replay_service
from app.state import state_store
from app.websocket import manager

router = APIRouter(prefix="/api/events", tags=["Events"])


@router.post("/trigger", response_model=TriggerEventResponse, summary="Trigger an emergency tactical event")
async def trigger_event_endpoint(req: TriggerEventRequest) -> TriggerEventResponse:
    event_id = f"EVT-{uuid.uuid4().hex[:6].upper()}"

    def _event_mutator(snap: StateSnapshot):
        actions, message = replan_logic(
            snapshot=snap,
            event_type=req.event_type,
            payload=req.payload,
        )

        entity_type = "SYSTEM"
        entity_id = None
        severity = "INFO"

        if req.event_type == EventType.RUNWAY_BLOCKED:
            entity_type = "AIRBASE"
            entity_id = req.payload.get("airbase_id") or (snap.airbases[0].id if snap.airbases else None)
            severity = "CRITICAL"
        elif req.event_type == EventType.NEW_THREAT_ZONE:
            entity_type = "THREAT_ZONE"
            entity_id = req.payload.get("threat_id") or "DYNAMIC_THREAT"
            severity = "WARNING"
        elif req.event_type == EventType.AIRCRAFT_FAILURE:
            entity_type = "AIRCRAFT"
            entity_id = req.payload.get("aircraft_id") or (snap.aircraft_fleet[0].aircraft_id if snap.aircraft_fleet else None)
            severity = "CRITICAL"

        # Log event entry with full provenance
        log_entry = EventLogEntry(
            event_id=event_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            event_type=req.event_type.value if hasattr(req.event_type, "value") else str(req.event_type),
            entity_type=entity_type,
            entity_id=entity_id,
            severity=severity,
            source="CONTINGENCY_SIMULATOR",
            description=message,
            affected_assets=[a.aircraft_id for a in actions],
            retasking_actions=actions,
            details=req.payload,
        )
        snap.event_log.append(log_entry)

        # Recalculate scenario before/after comparison
        state_store.compute_scenario_comparison(
            scenario_name=f"Tactical Contingency: {req.event_type.value if hasattr(req.event_type, 'value') else req.event_type}",
            affected_assets=[a.aircraft_id for a in actions] + ([entity_id] if entity_id else []),
        )

        return actions, message, snap.model_copy(deep=True)

    try:
        retask_actions, message, updated_snapshot = await state_store.mutate(_event_mutator)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))

    # Record into Replay Service
    severity_label = "CRITICAL" if req.event_type in (EventType.RUNWAY_BLOCKED, EventType.AIRCRAFT_FAILURE) else "WARNING"
    affected_ids = [a.aircraft_id for a in retask_actions]
    for key in ("airbase_id", "aircraft_id", "threat_id"):
        val = req.payload.get(key)
        if val and val not in affected_ids:
            affected_ids.append(val)

    replay_service.record_step(
        event_id=event_id,
        event_type=req.event_type.value if hasattr(req.event_type, "value") else str(req.event_type),
        title=f"Incident: {req.event_type.value if hasattr(req.event_type, 'value') else req.event_type}",
        description=message,
        severity=severity_label,
        affected_entity_ids=affected_ids,
        state_delta=req.payload,
        updated_snapshot=updated_snapshot,
    )

    # Real-time WebSocket Broadcasts
    await manager.broadcast("EVENT_ALERT", {
        "event_id": event_id,
        "event_type": req.event_type.value if hasattr(req.event_type, "value") else str(req.event_type),
        "message": message,
        "retasking_actions": [a.model_dump() for a in retask_actions],
    })

    await manager.broadcast("STATE_SNAPSHOT", updated_snapshot.model_dump())

    return TriggerEventResponse(
        status="PROCESSED",
        event_id=event_id,
        event_type=req.event_type,
        retasking_log=retask_actions,
        message=message,
    )


@router.get("/comparison", summary="Get active scenario before/after comparison")
async def get_scenario_comparison_endpoint():
    snapshot = await state_store.get_snapshot_async()
    return snapshot.active_scenario_comparison


@router.post("/reset", summary="Reset operational scenario to initial seeded baseline")
async def reset_scenario_endpoint() -> Dict[str, Any]:
    reset_snapshot = state_store.reset_to_initial()

    # Record scenario reset in replay service
    replay_service.on_reset(reset_snapshot)

    # Broadcast clean reset snapshot over WebSockets
    await manager.broadcast("STATE_SNAPSHOT", reset_snapshot.model_dump())
    await manager.broadcast("EVENT_ALERT", {
        "event_id": f"EVT-RESET-{uuid.uuid4().hex[:4].upper()}",
        "event_type": "RESET",
        "message": "Tactical scenario restored to initial seeded baseline.",
        "retasking_actions": [],
    })

    return {
        "status": "RESET_SUCCESS",
        "message": "Scenario cleanly reset to initial baseline (seed=42).",
        "last_updated": reset_snapshot.last_updated,
    }
