"""
Data Fusion & Quality Router: Multi-source trust assessment, freshness verification,
and contradiction/anomaly detection across synthetic C2 theatre records.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models import (
    AircraftStatus,
    DataQualityAnomaly,
    DataQualityReport,
    EventLogEntry,
    RunwayStatus,
    StateSnapshot,
)
from app.state import state_store
from app.websocket import manager

router = APIRouter(prefix="/api/data-fusion", tags=["Data Fusion & Quality"])

FRESHNESS_POLICIES: Dict[str, Dict[str, Any]] = {
    "aircraft_fleet": {
        "name": "Air Fleet Telemetry Feed",
        "threshold_hours": 6.0,
        "source_type": "SYNTHETIC_AVIONICS_BUS",
        "provenance": "Simulated Mil-Std-1553B avionics bus telemetry via synthetic state engine",
        "record_level_timestamps": False,
        "schema_version": "v1.4-synthetic",
    },
    "pilots": {
        "name": "Aviator Readiness & Rest Roster",
        "threshold_hours": 12.0,
        "source_type": "AIR_CREW_OPERATIONS_SYS",
        "provenance": "Squadron operational crew duty log and aviation medical fatigue registry",
        "record_level_timestamps": False,
        "schema_version": "v1.4-synthetic",
    },
    "airbases": {
        "name": "Forward Airbases & Runways",
        "threshold_hours": 24.0,
        "source_type": "BASE_OPS_INFRA_FEED",
        "provenance": "Station air engineering infrastructure telemetry and runway condition sensors",
        "record_level_timestamps": False,
        "schema_version": "v1.4-synthetic",
    },
    "weapons_inventory": {
        "name": "Theatre Ordnance Armory",
        "threshold_hours": 24.0,
        "source_type": "DEPOT_MUNITIONS_LEDGER",
        "provenance": "Armament depot central ordnance inventory and munitions storage ledger",
        "record_level_timestamps": False,
        "schema_version": "v1.4-synthetic",
    },
    "support_inventory": {
        "name": "Ground Support & Spare Logistics",
        "threshold_hours": 24.0,
        "source_type": "SUPPLY_CHAIN_INVENTORY_FEED",
        "provenance": "Depot logistics ERP store for critical LRUs, turbofan engines, and LOX",
        "record_level_timestamps": True,
        "schema_version": "v1.4-synthetic",
    },
    "threat_environment": {
        "name": "Tactical Threat & Radar Zones",
        "threshold_hours": 4.0,
        "source_type": "ELINT_SAT_RADAR_SURVEILLANCE",
        "provenance": "Electronic intelligence (ELINT) and synthetic SAR satellite radar track fusion",
        "record_level_timestamps": False,
        "schema_version": "v1.4-synthetic",
    },
    "mission_targets": {
        "name": "Strategic Target Catalog",
        "threshold_hours": 12.0,
        "source_type": "TARGETING_DIRECTORATE",
        "provenance": "Air Command strategic intelligence target dossiers and weapon pairing matrix",
        "record_level_timestamps": False,
        "schema_version": "v1.4-synthetic",
    },
    "active_missions": {
        "name": "Live Air Sorties",
        "threshold_hours": 0.5,
        "source_type": "C2_TACTICAL_DATA_LINK",
        "provenance": "Tactical Link-16/IACCS real-time airborne combat sortie telemetry",
        "record_level_timestamps": True,
        "schema_version": "v1.4-synthetic",
    },
    "maintenance_records": {
        "name": "Technical Maintenance Work Orders",
        "threshold_hours": 6.0,
        "source_type": "DEPOT_LOGISTICS_ERP",
        "provenance": "Base maintenance repair overhaul (MRO) work order and technician signoff registry",
        "record_level_timestamps": True,
        "schema_version": "v1.4-synthetic",
    },
    "event_log": {
        "name": "Audit & Tactical Change Timeline",
        "threshold_hours": 2.0,
        "source_type": "SYSTEM_AUDIT_LOG",
        "provenance": "AirPower distributed state mutation audit and event ledger",
        "record_level_timestamps": True,
        "schema_version": "v1.4-synthetic",
    },
}


def _evaluate_data_quality(snapshot: StateSnapshot, now: datetime) -> DataQualityReport:
    now_iso = now.isoformat()
    anomalies: List[DataQualityAnomaly] = []

    # -------------------------------------------------------------
    # 1. Dataset Collection Health & Freshness Evaluation
    # -------------------------------------------------------------
    try:
        ds_time = datetime.fromisoformat(snapshot.last_updated.replace("Z", "+00:00"))
        age_hours = round(max(0.0, (now - ds_time).total_seconds() / 3600.0), 2)
        is_future = (ds_time - now).total_seconds() > 60.0
    except Exception:
        ds_time = now
        age_hours = 0.0
        is_future = False

    if is_future:
        anomalies.append(
            DataQualityAnomaly(
                anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                collection="system_state",
                record_id="last_updated",
                category="TEMPORAL_FRESHNESS",
                severity="CRITICAL",
                rule_name="UNEXPECTED_FUTURE_TIMESTAMP",
                description=f"Snapshot last_updated ({snapshot.last_updated}) is in the future relative to system clock.",
                detected_at=now_iso,
                recommended_action="Synchronize system NTP clocks and recalibrate telemetry ingestion node.",
            )
        )

    sources: List[Dict[str, Any]] = []

    collections_map = {
        "aircraft_fleet": snapshot.aircraft_fleet,
        "pilots": snapshot.pilots,
        "airbases": snapshot.airbases,
        "weapons_inventory": snapshot.weapons_inventory,
        "support_inventory": snapshot.support_inventory,
        "threat_environment": snapshot.threat_environment,
        "mission_targets": snapshot.mission_targets,
        "active_missions": snapshot.active_missions,
        "maintenance_records": snapshot.maintenance_records,
        "event_log": snapshot.event_log,
    }

    for col_key, policy in FRESHNESS_POLICIES.items():
        records = collections_map.get(col_key, [])
        record_count = len(records)
        threshold = policy["threshold_hours"]

        # Check freshness
        if is_future:
            freshness_status = "STALE"
        elif age_hours <= threshold:
            freshness_status = "FRESH"
        else:
            freshness_status = "STALE"

        sources.append(
            {
                "collection": col_key,
                "name": policy["name"],
                "record_count": record_count,
                "source_type": policy["source_type"],
                "provenance": policy["provenance"],
                "schema_version": policy["schema_version"],
                "record_level_timestamps": policy["record_level_timestamps"],
                "last_updated": snapshot.last_updated,
                "calculated_age_hours": age_hours,
                "freshness_threshold_hours": threshold,
                "freshness": freshness_status,
                "validation_status": "PASSED",
                "detected_issues_count": 0,
            }
        )

    # -------------------------------------------------------------
    # 2. Schema, Coordinates, & Relational Integrity Validation
    # -------------------------------------------------------------
    airbase_ids = {b.id for b in snapshot.airbases}
    aircraft_ids = {a.aircraft_id for a in snapshot.aircraft_fleet}
    weapon_ids = {w.weapon_id for w in snapshot.weapons_inventory}
    pilot_ids = {p.pilot_id for p in snapshot.pilots}

    # Duplicate ID checks
    def _check_duplicates(items: list, id_getter, col_name: str):
        seen = set()
        for it in items:
            it_id = id_getter(it)
            if it_id in seen:
                anomalies.append(
                    DataQualityAnomaly(
                        anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                        collection=col_name,
                        record_id=it_id,
                        category="SCHEMA_VALIDATION",
                        severity="CRITICAL",
                        rule_name="DUPLICATE_IDENTIFIER",
                        description=f"Duplicate primary key '{it_id}' detected in collection '{col_name}'.",
                        detected_at=now_iso,
                        recommended_action="Deduplicate dataset and regenerate unique entity keys.",
                    )
                )
            seen.add(it_id)

    _check_duplicates(snapshot.aircraft_fleet, lambda a: a.aircraft_id, "aircraft_fleet")
    _check_duplicates(snapshot.airbases, lambda b: b.id, "airbases")
    _check_duplicates(snapshot.pilots, lambda p: p.pilot_id, "pilots")
    _check_duplicates(snapshot.weapons_inventory, lambda w: w.weapon_id, "weapons_inventory")
    _check_duplicates(snapshot.support_inventory, lambda s: s.item_id, "support_inventory")

    # Airbase checks: Coordinates & Foreign keys
    for base in snapshot.airbases:
        if not (-90.0 <= base.lat <= 90.0 and -180.0 <= base.lng <= 180.0):
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="airbases",
                    record_id=base.id,
                    category="SCHEMA_VALIDATION",
                    severity="CRITICAL",
                    rule_name="INVALID_COORDINATES",
                    description=f"Airbase {base.name} ({base.id}) has invalid coordinates ({base.lat}, {base.lng}).",
                    detected_at=now_iso,
                    recommended_action="Correct latitude/longitude in geodetic spatial registry.",
                )
            )
        for w in base.stored_weapons:
            if w.weapon_id not in weapon_ids:
                anomalies.append(
                    DataQualityAnomaly(
                        anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                        collection="airbases",
                        record_id=base.id,
                        category="RELATIONAL_INTEGRITY",
                        severity="WARNING",
                        rule_name="BROKEN_WEAPON_RELATIONSHIP",
                        description=f"Airbase {base.name} stocks weapon '{w.weapon_id}' which does not exist in weapons inventory.",
                        detected_at=now_iso,
                        recommended_action="Register weapon in weapons_inventory or update station armory.",
                    )
                )

    # Aircraft checks: Foreign keys & equipped weapons
    for ac in snapshot.aircraft_fleet:
        if ac.home_base_id not in airbase_ids:
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="aircraft_fleet",
                    record_id=ac.aircraft_id,
                    category="RELATIONAL_INTEGRITY",
                    severity="CRITICAL",
                    rule_name="BROKEN_AIRBASE_FOREIGN_KEY",
                    description=f"Aircraft {ac.callsign} ({ac.aircraft_id}) references nonexistent home base '{ac.home_base_id}'.",
                    detected_at=now_iso,
                    recommended_action="Reassign airframe to a valid operational forward airbase.",
                )
            )
        for eq in ac.equipped_weapons:
            if eq.weapon_id not in weapon_ids:
                anomalies.append(
                    DataQualityAnomaly(
                        anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                        collection="aircraft_fleet",
                        record_id=ac.aircraft_id,
                        category="RELATIONAL_INTEGRITY",
                        severity="WARNING",
                        rule_name="BROKEN_WEAPON_RELATIONSHIP",
                        description=f"Aircraft {ac.callsign} ({ac.aircraft_id}) equipped with unregistered weapon '{eq.weapon_id}'.",
                        detected_at=now_iso,
                        recommended_action="Review weapon loadout sheet and reconcile munitions ledger.",
                    )
                )

    # Pilot checks: Foreign keys
    for p in snapshot.pilots:
        if p.home_base_id not in airbase_ids:
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="pilots",
                    record_id=p.pilot_id,
                    category="RELATIONAL_INTEGRITY",
                    severity="CRITICAL",
                    rule_name="BROKEN_AIRBASE_FOREIGN_KEY",
                    description=f"Pilot {p.name} ({p.pilot_id}) stationed at nonexistent base '{p.home_base_id}'.",
                    detected_at=now_iso,
                    recommended_action="Update personnel roster to station at an existing airbase.",
                )
            )
        if p.assigned_aircraft_id and p.assigned_aircraft_id not in aircraft_ids:
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="pilots",
                    record_id=p.pilot_id,
                    category="RELATIONAL_INTEGRITY",
                    severity="CRITICAL",
                    rule_name="BROKEN_AIRCRAFT_FOREIGN_KEY",
                    description=f"Pilot {p.name} assigned to nonexistent airframe '{p.assigned_aircraft_id}'.",
                    detected_at=now_iso,
                    recommended_action="Clear assigned_aircraft_id or pair with active airframe.",
                )
            )

    # -------------------------------------------------------------
    # 3. Operational Contradictions & Business Rules Validation
    # -------------------------------------------------------------

    # Rule A: Overdue Maintenance Work Orders
    for wo in snapshot.maintenance_records:
        status_val = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
        if status_val == "OVERDUE":
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="maintenance_records",
                    record_id=wo.record_id,
                    category="OPERATIONAL_CONFLICT",
                    severity="CRITICAL",
                    rule_name="OVERDUE_DEPOT_MAINTENANCE",
                    description=(
                        f"Work Order {wo.record_id} on {wo.resource_id} is OVERDUE. "
                        f"Task: {wo.description}. Planned completion was {wo.planned_completion}."
                    ),
                    detected_at=now_iso,
                    recommended_action="Expedite avionics technician crew or reassign airframe to reserve tier.",
                )
            )
        elif status_val in ("OPEN", "IN_PROGRESS") and wo.planned_completion:
            try:
                comp_dt = datetime.fromisoformat(wo.planned_completion.replace("Z", "+00:00"))
                if comp_dt < now:
                    anomalies.append(
                        DataQualityAnomaly(
                            anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                            collection="maintenance_records",
                            record_id=wo.record_id,
                            category="OPERATIONAL_CONFLICT",
                            severity="WARNING",
                            rule_name="PAST_DUE_WORK_ORDER",
                            description=(
                                f"Work Order {wo.record_id} planned completion was {wo.planned_completion}, "
                                f"which is in the past, but status remains '{status_val}'."
                            ),
                            detected_at=now_iso,
                            recommended_action="Update work order status to OVERDUE or record actual completion.",
                        )
                    )
            except Exception:
                pass

    # Rule B: Support Inventory Deficits & Reservation Discrepancies
    for item in snapshot.support_inventory:
        if item.quantity_on_hand <= item.reorder_threshold:
            sev = "CRITICAL" if item.quantity_on_hand <= 1 else "WARNING"
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="support_inventory",
                    record_id=item.item_id,
                    category="BUSINESS_RULE",
                    severity=sev,
                    rule_name="LOGISTICS_STOCK_DEFICIT",
                    description=(
                        f"Inventory item '{item.item_name}' at {item.airbase_id} is below reorder threshold "
                        f"({item.quantity_on_hand} {item.unit} available, reorder threshold is {item.reorder_threshold})."
                    ),
                    detected_at=now_iso,
                    recommended_action=f"Initiate priority replenishment requisition with supplier (Lead time: {item.supplier_lead_time_days} days).",
                )
            )
        if item.reserved_quantity > item.quantity_on_hand:
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="support_inventory",
                    record_id=item.item_id,
                    category="BUSINESS_RULE",
                    severity="CRITICAL",
                    rule_name="INVENTORY_OVER_RESERVED",
                    description=(
                        f"Item '{item.item_name}' has reserved quantity ({item.reserved_quantity}) exceeding on-hand stock ({item.quantity_on_hand})."
                    ),
                    detected_at=now_iso,
                    recommended_action="Audit work order part reservations and release canceled requisition holds.",
                )
            )

    # Rule C: Contradiction Check — Aircraft in MAINTENANCE assigned to flight or pilot
    maint_ac_ids = {a.aircraft_id for a in snapshot.aircraft_fleet if a.status in (AircraftStatus.MAINTENANCE, AircraftStatus.ABORTED)}
    for pilot in snapshot.pilots:
        if pilot.assigned_aircraft_id and pilot.assigned_aircraft_id in maint_ac_ids:
            anomalies.append(
                DataQualityAnomaly(
                    anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                    collection="pilots",
                    record_id=pilot.pilot_id,
                    category="OPERATIONAL_CONFLICT",
                    severity="CRITICAL",
                    rule_name="CONTRADICTORY_PILOT_ASSIGNMENT",
                    description=(
                        f"Pilot {pilot.name} ({pilot.pilot_id}) is assigned to aircraft {pilot.assigned_aircraft_id}, "
                        f"which is currently marked in MAINTENANCE/ABORTED status."
                    ),
                    detected_at=now_iso,
                    recommended_action="Unassign pilot from grounded airframe immediately.",
                )
            )

    # Rule D: Contradiction Check — Airbase BLOCKED with ready jets ready to launch without alert
    for base in snapshot.airbases:
        if base.runway_status == RunwayStatus.BLOCKED:
            ready_jets = [a for a in snapshot.aircraft_fleet if a.home_base_id == base.id and a.status == AircraftStatus.READY]
            if ready_jets:
                anomalies.append(
                    DataQualityAnomaly(
                        anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                        collection="airbases",
                        record_id=base.id,
                        category="OPERATIONAL_CONFLICT",
                        severity="WARNING",
                        rule_name="RUNWAY_LOCKOUT_CAPACITY_CONFLICT",
                        description=(
                            f"Airbase '{base.name}' runway is BLOCKED, but {len(ready_jets)} aircraft are designated READY at this station."
                        ),
                        detected_at=now_iso,
                        recommended_action="Retask or transfer aircraft to operational alternate bases.",
                    )
                )

    # Rule E: Pilot Fatigue Envelope Violations
    fatigued_assigned = [p for p in snapshot.pilots if p.assigned_aircraft_id and p.rest_hours_completed < 8.0]
    for p in fatigued_assigned:
        anomalies.append(
            DataQualityAnomaly(
                anomaly_id=f"ANOM-{uuid.uuid4().hex[:6].upper()}",
                collection="pilots",
                record_id=p.pilot_id,
                category="BUSINESS_RULE",
                severity="CRITICAL",
                rule_name="AVIATOR_FATIGUE_ENVELOPE_EXCEEDED",
                description=(
                    f"Aviator {p.name} ({p.pilot_id}) assigned to active flight duty with only {p.rest_hours_completed}h rest (8.0h mandatory)."
                ),
                detected_at=now_iso,
                recommended_action="Execute immediate crew swap with standby rested aviator.",
            )
        )

    # -------------------------------------------------------------
    # 4. Summary & Score Compilation
    # -------------------------------------------------------------
    # Map detected issues back to sources
    issues_by_collection: Dict[str, int] = {}
    for a in anomalies:
        issues_by_collection[a.collection] = issues_by_collection.get(a.collection, 0) + 1

    for s in sources:
        col = s["collection"]
        cnt = issues_by_collection.get(col, 0)
        s["detected_issues_count"] = cnt
        if cnt == 0:
            s["validation_status"] = "PASSED"
        elif any(a.severity == "CRITICAL" for a in anomalies if a.collection == col):
            s["validation_status"] = "FAILED"
        else:
            s["validation_status"] = "WARNING"

    crit_count = sum(1 for a in anomalies if a.severity == "CRITICAL")
    warn_count = sum(1 for a in anomalies if a.severity == "WARNING")
    info_count = sum(1 for a in anomalies if a.severity == "INFO")

    deductions = (crit_count * 7.5) + (warn_count * 2.5) + (info_count * 1.0)
    overall_score = max(45.0, round(100.0 - deductions, 1))

    total_records = sum(s["record_count"] for s in sources)
    records_with_issues = len({a.record_id for a in anomalies if a.record_id})
    records_passing = max(0, total_records - records_with_issues)

    fresh_count = sum(1 for s in sources if s["freshness"] == "FRESH")
    stale_count = sum(1 for s in sources if s["freshness"] == "STALE")

    report = DataQualityReport(
        overall_quality_score=overall_score,
        dataset_last_updated=snapshot.last_updated,
        import_timestamp="2026-10-07T06:00:00Z",
        sources=sources,
        anomalies=anomalies,
        freshness_summary={
            "fresh": fresh_count,
            "stale": stale_count,
            "validation_required": 0,
            "total_anomalies": len(anomalies),
            "critical_anomalies": crit_count,
            "warning_anomalies": warn_count,
            "info_anomalies": info_count,
        },
        summary_stats={
            "total_records_examined": total_records,
            "records_passing_validation": records_passing,
            "records_requiring_review": records_with_issues,
            "collections_count": len(sources),
            "synthetic_disclaimer": "All datasets represent synthetic operational demonstration records.",
        },
    )
    return report


@router.get("/trust", response_model=DataQualityReport, summary="Get full Data Fusion and Quality Report")
async def get_data_fusion_report() -> DataQualityReport:
    snapshot = await state_store.get_snapshot_async()
    now = datetime.now(timezone.utc)
    return _evaluate_data_quality(snapshot, now)


@router.get("/source/{collection_name}", summary="Inspect raw records and schema details for a specific collection")
async def inspect_source_collection(collection_name: str) -> Dict[str, Any]:
    snapshot = await state_store.get_snapshot_async()
    policy = FRESHNESS_POLICIES.get(collection_name)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown collection '{collection_name}'. Available: {list(FRESHNESS_POLICIES.keys())}",
        )

    collections_map = {
        "aircraft_fleet": [a.model_dump() for a in snapshot.aircraft_fleet],
        "pilots": [p.model_dump() for p in snapshot.pilots],
        "airbases": [b.model_dump() for b in snapshot.airbases],
        "weapons_inventory": [w.model_dump() for w in snapshot.weapons_inventory],
        "support_inventory": [s.model_dump() for s in snapshot.support_inventory],
        "threat_environment": [t.model_dump() for t in snapshot.threat_environment],
        "mission_targets": [m.model_dump() for m in snapshot.mission_targets],
        "active_missions": [m.model_dump() for m in snapshot.active_missions],
        "maintenance_records": [m.model_dump() for m in snapshot.maintenance_records],
        "event_log": [e.model_dump() for e in snapshot.event_log],
    }

    records = collections_map.get(collection_name, [])
    return {
        "collection": collection_name,
        "name": policy["name"],
        "record_count": len(records),
        "source_type": policy["source_type"],
        "provenance": policy["provenance"],
        "schema_version": policy["schema_version"],
        "record_level_timestamps": policy["record_level_timestamps"],
        "last_updated": snapshot.last_updated,
        "records": records,
    }


@router.post("/revalidate", response_model=DataQualityReport, summary="Force rerun data quality validators and log validation audit event")
async def force_revalidate_data() -> DataQualityReport:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    def _mutator(snap: StateSnapshot):
        evt = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now_iso,
            event_type="SYSTEM_VALIDATION",
            entity_type="SYSTEM",
            entity_id="DATA_FUSION_ENGINE",
            severity="INFO",
            source="DATA_FUSION_TRUST_CENTRE",
            description="Manual comprehensive re-validation executed across all 10 synthetic datasets.",
            affected_assets=["GLOBAL_C2_STATE"],
            details={"validation_mode": "MANUAL_REVALIDATE", "triggered_at": now_iso},
        )
        snap.event_log.append(evt)
        return evt, snap.model_copy(deep=True)

    _, updated_snap = await state_store.mutate(_mutator)
    report = _evaluate_data_quality(updated_snap, now)
    await manager.broadcast("DATA_QUALITY_UPDATE", report.model_dump())
    return report
