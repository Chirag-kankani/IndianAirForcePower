"""
Missions Router: Mission Planning, Package Deployment, and Active Mission Retrieval.
"""
from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status

from app.models import (
    ActiveMission,
    AircraftStatus,
    EventLogEntry,
    EventType,
    Location,
    MissionPackage,
    MissionStatus,
    MissionTarget,
    PlanMissionRequest,
    PlanMissionResponse,
    RetaskAction,
    TARGET_MAPPING_RULES,
    TargetType,
)
from app.optimizer import plan_mission
from app.replay_service import replay_service
from app.state import state_store

router = APIRouter(prefix="/api/missions", tags=["Missions"])

# In-memory temporary cache of generated candidate packages
PACKAGE_CACHE: Dict[str, MissionPackage] = {}


@router.post("/plan", response_model=PlanMissionResponse, summary="Compute constrained-optimal Top-3 mission packages")
async def plan_mission_endpoint(req: PlanMissionRequest) -> PlanMissionResponse:
    snapshot = await state_store.get_snapshot_async()

    # Determine target
    target: Optional[MissionTarget] = None
    if req.target_id:
        target = next((t for t in snapshot.mission_targets if t.target_id == req.target_id), None)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission target ID '{req.target_id}' not found in state.",
            )
    elif req.custom_target and req.target_type:
        rule = TARGET_MAPPING_RULES.get(req.target_type, {})
        req_weapon = req.required_weapon_category or rule.get("required_weapon_category")
        req_quals = rule.get("required_pilot_qualifications", [])

        target = MissionTarget(
            target_id=f"TGT_CUSTOM_{int(datetime.now(timezone.utc).timestamp())}",
            name=f"Tactical Strike at {req.custom_target.lat:.2f}N, {req.custom_target.lng:.2f}E",
            location=req.custom_target,
            target_type=req.target_type,
            required_weapon_category=req_weapon,
            priority_level=req.priority_level,
            time_window_mins=60,
            required_pilot_qualifications=req_quals,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify either 'target_id' or ('custom_target' and 'target_type').",
        )

    # Execute CP-SAT Planner
    plan_response = plan_mission(target=target, snapshot=snapshot, top_k=3)

    # Store packages in cache
    for pkg in plan_response.packages:
        PACKAGE_CACHE[pkg.package_id] = pkg

    return plan_response


@router.post("/{package_id}/deploy", response_model=ActiveMission, summary="Deploy an approved mission package")
async def deploy_package_endpoint(package_id: str) -> ActiveMission:
    pkg = PACKAGE_CACHE.get(package_id)
    if not pkg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Package ID '{package_id}' not found or has expired. Please run /plan again.",
        )

    def _deploy_mutator(snap):
        # 1. Update Aircraft Status
        ac = next((a for a in snap.aircraft_fleet if a.aircraft_id == pkg.aircraft.aircraft_id), None)
        if not ac or ac.status != AircraftStatus.READY:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Aircraft '{pkg.aircraft.aircraft_id}' is no longer in READY status.",
            )
        ac.status = AircraftStatus.AIRBORNE

        # 2. Update Pilot Assignment
        pilot = next((p for p in snap.pilots if p.pilot_id == pkg.pilot.pilot_id), None)
        if not pilot:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pilot '{pkg.pilot.pilot_id}' not found in roster.",
            )
        pilot.assigned_aircraft_id = ac.aircraft_id

        # 3. Decrement Weapons Stock
        for payload_item in pkg.ordnance_payload:
            wep = next((w for w in snap.weapons_inventory if w.weapon_id == payload_item.weapon_id), None)
            if wep:
                wep.stock_count = max(0, wep.stock_count - payload_item.qty)

        # 4. Create ActiveMission record
        mission_id = f"MSN-{int(datetime.now(timezone.utc).timestamp()) % 10000:04d}"
        target_obj = next((t for t in snap.mission_targets if t.target_id == pkg.target_id), None)
        if not target_obj:
            engage_wp = next((w for w in pkg.route.waypoints if w.action == "ENGAGE"), pkg.route.waypoints[-1])
            target_obj = MissionTarget(
                target_id=pkg.target_id,
                name=engage_wp.name,
                location=Location(lat=engage_wp.lat, lng=engage_wp.lng, name=engage_wp.name),
                target_type=TargetType.HARDENED_BUNKER,
                required_weapon_category=pkg.ordnance_payload[0].category if pkg.ordnance_payload else WeaponCategory.PRECISION_GUIDED_BOMB,
                priority_level=3,
                time_window_mins=60,
            )

        active_mission = ActiveMission(
            mission_id=mission_id,
            package_id=pkg.package_id,
            target=target_obj,
            aircraft=ac,
            pilot=pilot,
            airbase=pkg.airbase,
            ordnance_payload=pkg.ordnance_payload,
            route=pkg.route,
            status=MissionStatus.ACTIVE,
            deployed_at=datetime.now(timezone.utc).isoformat(),
            current_waypoint_index=0,
            current_position=Location(lat=pkg.airbase.lat, lng=pkg.airbase.lng, name=pkg.airbase.name),
        )
        snap.active_missions.append(active_mission)

        # 5. Log deployment event
        event_entry = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            event_type=EventType.RUNWAY_BLOCKED,  # standard log event category
            description=f"Mission {mission_id} ({ac.callsign} / {pilot.name}) DEPLOYED to target {pkg.target_id}.",
            affected_assets=[ac.aircraft_id, pilot.pilot_id, pkg.airbase.id],
            retasking_actions=[
                RetaskAction(
                    mission_id=mission_id,
                    aircraft_id=ac.aircraft_id,
                    action_type="DEPLOYED",
                    reason="Commander Approval",
                    details=f"Package {pkg.package_id} committed. Route distance: {pkg.route.distance_km} km, ETA: {pkg.route.eta_mins} mins.",
                )
            ],
        )
        snap.event_log.append(event_entry)

        return active_mission

    deployed_mission = await state_store.mutate(_deploy_mutator)
    current_snap = await state_store.get_snapshot_async()
    replay_service.record_step(
        event_id=f"EVT-DEPLOY-{deployed_mission.mission_id}",
        event_type="MISSION_DEPLOYED",
        title=f"Sortie Deployed: {deployed_mission.aircraft.callsign}",
        description=f"Package committed with pilot {deployed_mission.pilot.name} targeting {deployed_mission.target.name}.",
        severity="INFO",
        affected_entity_ids=[deployed_mission.aircraft.aircraft_id, deployed_mission.pilot.pilot_id, deployed_mission.target.target_id],
        state_delta={"mission_id": deployed_mission.mission_id, "status": "ACTIVE"},
        updated_snapshot=current_snap,
    )
    return deployed_mission


@router.get("", response_model=List[ActiveMission], summary="Get all currently active deployed missions")
async def list_active_missions() -> List[ActiveMission]:
    snapshot = await state_store.get_snapshot_async()
    return snapshot.active_missions


@router.post("/{mission_id}/close", response_model=ActiveMission, summary="Close / End an active mission and recover assigned aircraft/pilot")
async def close_mission_endpoint(mission_id: str) -> ActiveMission:
    def _close_mutator(snap):
        # 1. Locate active mission
        target_mission = next((m for m in snap.active_missions if m.mission_id == mission_id), None)
        if not target_mission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Active mission with ID '{mission_id}' not found.",
            )

        # 2. Release assigned aircraft back to READY
        ac = next((a for a in snap.aircraft_fleet if a.aircraft_id == target_mission.aircraft.aircraft_id), None)
        if ac:
            ac.status = AircraftStatus.READY

        # 3. Release assigned pilot
        pilot = next((p for p in snap.pilots if p.pilot_id == target_mission.pilot.pilot_id), None)
        if pilot:
            pilot.assigned_aircraft_id = None
            pilot.consecutive_flight_hours = max(0.0, pilot.consecutive_flight_hours)

        # 4. Remove from active missions
        snap.active_missions = [m for m in snap.active_missions if m.mission_id != mission_id]

        # 5. Log mission completion / closure event
        closed_mission_copy = target_mission.model_copy()
        closed_mission_copy.status = MissionStatus.COMPLETED

        event_entry = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            event_type=EventType.RUNWAY_BLOCKED,
            description=f"Mission {mission_id} ({target_mission.aircraft.callsign} / {target_mission.pilot.name}) CLOSED and successfully completed.",
            affected_assets=[target_mission.aircraft.aircraft_id, target_mission.pilot.pilot_id, target_mission.airbase.id],
            retasking_actions=[
                RetaskAction(
                    mission_id=mission_id,
                    aircraft_id=target_mission.aircraft.aircraft_id,
                    action_type="COMPLETED",
                    reason="Mission Closed by Commander",
                    details=f"Sortie successfully concluded. {target_mission.aircraft.callsign} and Pilot {target_mission.pilot.name} returned to {target_mission.airbase.name} in READY status.",
                )
            ],
        )
        snap.event_log.append(event_entry)

        return closed_mission_copy

    closed_msn = await state_store.mutate(_close_mutator)
    current_snap = await state_store.get_snapshot_async()
    replay_service.record_step(
        event_id=f"EVT-CLOSE-{mission_id}",
        event_type="MISSION_CLOSED",
        title=f"Sortie Concluded: {closed_msn.aircraft.callsign}",
        description=f"Active sortie {mission_id} concluded. Aircraft returned to operational readiness.",
        severity="INFO",
        affected_entity_ids=[closed_msn.aircraft.aircraft_id, closed_msn.pilot.pilot_id, mission_id],
        state_delta={"mission_id": mission_id, "status": "CLOSED"},
        updated_snapshot=current_snap,
    )
    return closed_msn
