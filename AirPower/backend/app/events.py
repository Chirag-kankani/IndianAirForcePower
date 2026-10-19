"""
Dynamic Event Handlers and Real-Time Replanning Engine for AirPower.
Implements deterministic, auditable retasking logic for emergency theatre events.
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from shapely.geometry import LineString, Point

from app.geo import (
    compute_route_threat_exposure,
    compute_route_total_distance_km,
    generate_detour_waypoints,
    haversine_distance_km,
)
from app.models import (
    ActiveMission,
    AircraftStatus,
    EventLogEntry,
    EventType,
    Location,
    MissionStatus,
    MissionTarget,
    RetaskAction,
    RunwayStatus,
    StateSnapshot,
    ThreatType,
    ThreatZone,
    Waypoint,
)
from app.optimizer import plan_mission


def replan_logic(
    snapshot: StateSnapshot,
    event_type: EventType,
    payload: Dict[str, Any],
) -> Tuple[List[RetaskAction], str]:
    """
    Executes domain-specific replanning logic against the in-memory state snapshot.
    Returns: (list_of_retasking_actions, human_readable_summary_message)
    """
    retask_actions: List[RetaskAction] = []
    summary_message = ""

    # =========================================================================
    # 1. EVENT: RUNWAY_BLOCKED
    # =========================================================================
    if event_type == EventType.RUNWAY_BLOCKED:
        base_id = payload.get("airbase_id")
        if not base_id:
            # Automatic fallback: pick the base of the first active mission or default to first base
            if snapshot.active_missions:
                base_id = snapshot.active_missions[0].airbase.id
            else:
                base_id = snapshot.airbases[0].id

        target_base = next((b for b in snapshot.airbases if b.id == base_id), None)
        if not target_base:
            raise ValueError(f"Airbase '{base_id}' not found in state.")

        # Mutate base status
        target_base.runway_status = RunwayStatus.BLOCKED

        # Identify affected active missions
        for msn in snapshot.active_missions:
            if msn.airbase.id == base_id or (msn.route.waypoints and msn.route.waypoints[-1].name.startswith(f"Recovery ({target_base.name}")):
                # Find best alternate operational base
                operational_bases = [
                    b for b in snapshot.airbases
                    if b.id != base_id and b.runway_status == RunwayStatus.OPERATIONAL
                ]

                if not operational_bases:
                    action = RetaskAction(
                        mission_id=msn.mission_id,
                        aircraft_id=msn.aircraft.aircraft_id,
                        action_type="ABORTED",
                        reason="NO_OPERATIONAL_BASES",
                        details=f"CRITICAL: Base {target_base.name} locked out and no other operational airbases available in theatre.",
                    )
                    retask_actions.append(action)
                    continue

                # Evaluate fuel feasibility for each candidate alternate base
                # Distance from mission target location to alternate base
                viable_alts: List[Tuple[float, Any, float]] = []  # (dist, base, fuel_needed)
                current_fuel_liters = msn.aircraft.current_fuel_liters

                for alt_base in operational_bases:
                    dist_to_alt = haversine_distance_km(
                        msn.target.location.lat, msn.target.location.lng,
                        alt_base.lat, alt_base.lng
                    )
                    fuel_needed = dist_to_alt * msn.aircraft.fuel_burn_liters_per_km * 1.1  # 10% reserve margin
                    if current_fuel_liters >= fuel_needed:
                        viable_alts.append((dist_to_alt, alt_base, fuel_needed))

                if viable_alts:
                    viable_alts.sort(key=lambda x: x[0])  # Sort by nearest distance
                    chosen_dist, chosen_base, chosen_fuel = viable_alts[0]

                    # Update route recovery waypoint
                    if msn.route.waypoints:
                        msn.route.waypoints[-1] = Waypoint(
                            lat=chosen_base.lat,
                            lng=chosen_base.lng,
                            name=f"Emergency Recovery ({chosen_base.name})",
                            action="RECOVERY",
                        )
                        # Recalculate route metrics
                        old_dist = msn.route.distance_km
                        old_eta = msn.route.eta_mins
                        new_dist = compute_route_total_distance_km(msn.route.waypoints)
                        new_eta = round((new_dist / msn.aircraft.cruise_speed_kmph) * 60.0, 1)
                        added_mins = max(0.0, round(new_eta - old_eta, 1))

                        msn.route.distance_km = new_dist
                        msn.route.eta_mins = new_eta
                        msn.route.fuel_needed_liters = round(new_dist * msn.aircraft.fuel_burn_liters_per_km, 1)
                        msn.route.rerouted = True
                        msn.route.detour_notes = f"Diverted recovery to {chosen_base.name} (runway lockout at {target_base.name})"
                        msn.status = MissionStatus.REROUTED

                    action = RetaskAction(
                        mission_id=msn.mission_id,
                        aircraft_id=msn.aircraft.aircraft_id,
                        action_type="DIVERTED",
                        reason=f"Runway lockout at departure base {target_base.name}",
                        details=f"Diverted recovery to {chosen_base.name}. Distance to alternate: {chosen_dist:.1f} km (Fuel required: {chosen_fuel:.0f}L). Route ETA adjusted by +{added_mins} mins.",
                        added_time_mins=added_mins,
                        new_recovery_base_id=chosen_base.id,
                    )
                    retask_actions.append(action)
                else:
                    action = RetaskAction(
                        mission_id=msn.mission_id,
                        aircraft_id=msn.aircraft.aircraft_id,
                        action_type="DIVERTED",
                        reason="FUEL_CRITICAL_DIVERSION",
                        details=f"CRITICAL: Insufficient fuel margin for standard alternate. Directed to nearest coastal strip with immediate airborne tanker vector.",
                        new_recovery_base_id=operational_bases[0].id,
                    )
                    retask_actions.append(action)

        summary_message = (
            f"Airbase '{target_base.name}' status set to BLOCKED. "
            f"Evaluated {len(snapshot.active_missions)} active missions and retasked {len(retask_actions)} aircraft."
        )

    # =========================================================================
    # 2. EVENT: NEW_THREAT_ZONE
    # =========================================================================
    elif event_type == EventType.NEW_THREAT_ZONE:
        threat_id = payload.get("threat_id") or f"THREAT_DYNAMIC_{uuid.uuid4().hex[:4].upper()}"
        threat_name = payload.get("name") or "Dynamic SAM Radar Pop-Up Zone"
        threat_type = payload.get("type") or ThreatType.SAM_RADAR_BATTERY
        lat = float(payload.get("lat", 29.5))
        lng = float(payload.get("lng", 73.5))
        radius_km = float(payload.get("radius_km", 65.0))
        severity = int(payload.get("severity", 4))
        countermeasure = payload.get("countermeasure_required") or "DEAD_SEAD_CHAFF_FLARES"

        # Construct and register new ThreatZone
        new_threat = ThreatZone(
            threat_id=threat_id,
            name=threat_name,
            type=threat_type,
            center_location=Location(lat=lat, lng=lng, name=threat_name),
            effective_radius_km=radius_km,
            threat_severity=severity,
            countermeasure_required=countermeasure,
        )
        snapshot.threat_environment.append(new_threat)

        # Coordinate converter for Shapely geometric intersection
        # Both converters use the threat center as the local km-space origin.
        km_per_deg_lat = 111.0
        km_per_deg_lng = 111.0 * math.cos(math.radians(lat))

        def to_km(p_lat: float, p_lng: float) -> Tuple[float, float]:
            """Convert geographic coordinate to km offset from threat center."""
            return ((p_lng - lng) * km_per_deg_lng, (p_lat - lat) * km_per_deg_lat)

        def to_geo(km_x: float, km_y: float) -> Tuple[float, float]:
            """Convert km offset from threat center back to geographic coordinate."""
            return round(lat + (km_y / km_per_deg_lat), 4), round(lng + (km_x / km_per_deg_lng), 4)

        threat_circle = Point(0, 0).buffer(radius_km)

        # Test intersection with all active mission polylines
        for msn in snapshot.active_missions:
            if not msn.route.waypoints or len(msn.route.waypoints) < 2:
                continue

            # Build Shapely LineString from route waypoints (km space)
            route_coords = [to_km(w.lat, w.lng) for w in msn.route.waypoints]
            flight_polyline = LineString(route_coords)

            if flight_polyline.intersects(threat_circle):
                old_dist = msn.route.distance_km
                old_eta = msn.route.eta_mins

                # ── Corrected detour anchor calculation ───────────────────────
                # 1. Find the closest point on the route polyline to the threat
                #    center (origin in km space). This is our "anchor" for the
                #    perpendicular offset — not the threat center itself.
                closest_pt = flight_polyline.interpolate(flight_polyline.project(Point(0, 0)))
                anchor_x, anchor_y = closest_pt.x, closest_pt.y

                # 2. Compute the direction vector along the route at the anchor.
                #    Use the overall ingress→first-engage (or last waypoint) dir.
                engage_idx = next(
                    (i for i, w in enumerate(msn.route.waypoints) if w.action == "ENGAGE"),
                    len(msn.route.waypoints) - 1,
                )
                ingress_km = to_km(msn.route.waypoints[0].lat, msn.route.waypoints[0].lng)
                engage_km = to_km(msn.route.waypoints[engage_idx].lat, msn.route.waypoints[engage_idx].lng)

                dx = engage_km[0] - ingress_km[0]
                dy = engage_km[1] - ingress_km[1]
                line_len = math.hypot(dx, dy) or 1.0

                # 3. Perpendicular unit normal (left-hand side of travel direction)
                nx = -dy / line_len
                ny = dx / line_len

                # 4. Offset from the ANCHOR point by (radius + 15% margin)
                #    so the detour clears the threat bubble.
                offset_dist = radius_km * 1.15
                detour_km_x = anchor_x + nx * offset_dist
                detour_km_y = anchor_y + ny * offset_dist

                # 5. If offset somehow still intersects threat (edge case), try
                #    the right-hand perpendicular instead.
                if Point(detour_km_x, detour_km_y).within(threat_circle):
                    detour_km_x = anchor_x - nx * offset_dist
                    detour_km_y = anchor_y - ny * offset_dist

                d_lat, d_lng = to_geo(detour_km_x, detour_km_y)
                # ─────────────────────────────────────────────────────────────

                detour_waypoint = Waypoint(
                    lat=d_lat,
                    lng=d_lng,
                    name=f"Evasive Detour ({threat_name[:12]})",
                    action="DETOUR",
                )

                # Insert detour into route waypoints before the engage waypoint
                msn.route.waypoints.insert(engage_idx, detour_waypoint)
                # engage_idx shifts by one after insert; recalculate for logging
                new_engage_idx = engage_idx + 1

                # Recompute route metrics
                new_dist = compute_route_total_distance_km(msn.route.waypoints)
                new_eta = round((new_dist / msn.aircraft.cruise_speed_kmph) * 60.0, 1)
                new_fuel = round(new_dist * msn.aircraft.fuel_burn_liters_per_km, 1)
                added_mins = max(0.0, round(new_eta - old_eta, 1))

                msn.route.distance_km = new_dist
                msn.route.eta_mins = new_eta
                msn.route.fuel_needed_liters = new_fuel
                msn.route.rerouted = True
                msn.route.detour_notes = (
                    f"Rerouted around newly spawned threat '{threat_name}' "
                    f"(+{added_mins} mins ETD). Detour anchor: {d_lat}°N {d_lng}°E."
                )
                msn.status = MissionStatus.REROUTED

                action = RetaskAction(
                    mission_id=msn.mission_id,
                    aircraft_id=msn.aircraft.aircraft_id,
                    action_type="REROUTED",
                    reason=f"New High-Severity Threat Detected: {threat_name} (Severity {severity})",
                    details=(
                        f"Inserted tactical detour node at {d_lat}°N, {d_lng}°E — "
                        f"lateral offset {offset_dist:.1f} km from threat axis. "
                        f"Avoids {radius_km} km threat bubble. Flight time delta: +{added_mins} mins ETD."
                    ),
                    added_time_mins=added_mins,
                )
                retask_actions.append(action)

        summary_message = (
            f"Threat Zone '{threat_name}' (Radius {radius_km}km, Severity {severity}) registered. "
            f"Rerouted {len(retask_actions)} intersecting active flight routes."
        )

    # =========================================================================
    # 3. EVENT: AIRCRAFT_FAILURE
    # =========================================================================
    elif event_type == EventType.AIRCRAFT_FAILURE:
        ac_id = payload.get("aircraft_id")
        if not ac_id:
            # Fallback: pick the aircraft of the first active mission or first ready aircraft
            if snapshot.active_missions:
                ac_id = snapshot.active_missions[0].aircraft.aircraft_id
            else:
                ac_id = snapshot.aircraft_fleet[0].aircraft_id

        target_ac = next((a for a in snapshot.aircraft_fleet if a.aircraft_id == ac_id), None)
        if not target_ac:
            raise ValueError(f"Aircraft '{ac_id}' not found in state.")

        # Mark failed aircraft ABORTED
        target_ac.status = AircraftStatus.ABORTED

        # Find associated active mission if any
        associated_msn = next((m for m in snapshot.active_missions if m.aircraft.aircraft_id == ac_id), None)
        if associated_msn:
            associated_msn.status = MissionStatus.ABORTED

            # Remove aborted mission from the active list so the replacement can take over
            snapshot.active_missions = [
                m for m in snapshot.active_missions if m.mission_id != associated_msn.mission_id
            ]

            # Unassign the failed pilot
            failed_pilot = next((p for p in snapshot.pilots if p.pilot_id == associated_msn.pilot.pilot_id), None)
            if failed_pilot:
                failed_pilot.assigned_aircraft_id = None

            # Trigger replanning for replacement standby jet
            replan_res = plan_mission(target=associated_msn.target, snapshot=snapshot, top_k=1)
            if replan_res.status == "FEASIBLE" and replan_res.packages:
                replacement_pkg = replan_res.packages[0]

                # ---- Commit replacement to state ----
                # 1. Mark replacement aircraft AIRBORNE
                replacement_ac = next(
                    (a for a in snapshot.aircraft_fleet if a.aircraft_id == replacement_pkg.aircraft.aircraft_id), None
                )
                if replacement_ac:
                    replacement_ac.status = AircraftStatus.AIRBORNE

                # 2. Assign replacement pilot
                replacement_pilot = next(
                    (p for p in snapshot.pilots if p.pilot_id == replacement_pkg.pilot.pilot_id), None
                )
                if replacement_pilot:
                    replacement_pilot.assigned_aircraft_id = replacement_pkg.aircraft.aircraft_id

                # 3. Create a new ActiveMission with the replacement aircraft identity
                new_mission_id = f"MSN-RPLC-{uuid.uuid4().hex[:4].upper()}"
                replacement_mission = ActiveMission(
                    mission_id=new_mission_id,
                    package_id=replacement_pkg.package_id,
                    target=associated_msn.target,
                    aircraft=replacement_pkg.aircraft,
                    pilot=replacement_pkg.pilot,
                    airbase=replacement_pkg.airbase,
                    ordnance_payload=replacement_pkg.ordnance_payload,
                    route=replacement_pkg.route,
                    status=MissionStatus.ACTIVE,
                    deployed_at=datetime.now(timezone.utc).isoformat(),
                    current_waypoint_index=0,
                    current_position=Location(
                        lat=replacement_pkg.airbase.lat,
                        lng=replacement_pkg.airbase.lng,
                        name=replacement_pkg.airbase.name,
                    ),
                )
                snapshot.active_missions.append(replacement_mission)

                action = RetaskAction(
                    mission_id=new_mission_id,
                    aircraft_id=replacement_pkg.aircraft.aircraft_id,
                    action_type="REPLACED",
                    reason=f"In-flight engine fault on {target_ac.callsign} — standby scramble authorised",
                    details=(
                        f"ORIGINAL: {target_ac.callsign} ({target_ac.model}) → ABORTED. "
                        f"REPLACEMENT: {replacement_pkg.aircraft.callsign} ({replacement_pkg.aircraft.model}) "
                        f"piloted by {replacement_pkg.pilot.name} ({replacement_pkg.pilot.rank}) "
                        f"from {replacement_pkg.airbase.name}. "
                        f"New mission ID: {new_mission_id}. "
                        f"Estimated scramble delay: +{replacement_pkg.aircraft.turnaround_time_mins} mins."
                    ),
                    added_time_mins=float(replacement_pkg.aircraft.turnaround_time_mins),
                )
                retask_actions.append(action)
            else:
                action = RetaskAction(
                    mission_id=associated_msn.mission_id,
                    aircraft_id=ac_id,
                    action_type="ABORTED",
                    reason="In-flight equipment failure — no eligible standby replacement available",
                    details=(
                        f"Aircraft {target_ac.callsign} ({target_ac.model}) returned to base for emergency maintenance. "
                        "No replacement sortie could be generated: all remaining aircraft fail constraint checks. "
                        "Manual intervention required."
                    ),
                )
                retask_actions.append(action)
        else:
            action = RetaskAction(
                mission_id="STANDBY",
                aircraft_id=ac_id,
                action_type="ABORTED",
                reason="Pre-flight diagnostic failure",
                details=f"Aircraft {target_ac.callsign} grounded — moved to MAINTENANCE status.",
            )
            retask_actions.append(action)

        summary_message = (
            f"Aircraft '{target_ac.callsign}' marked ABORTED. "
            f"Processed emergency retasking: {len(retask_actions)} action(s) generated."
        )

    return retask_actions, summary_message
