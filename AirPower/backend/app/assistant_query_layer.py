"""
Read-Only Query Layer for AirPower AI Operations Assistant.
Provides controlled, allowlisted read operations accessing existing
StateStore, Data Fusion, Maintenance, Weather, and Replay modules.
Enforces strict read-only execution, bounded pagination, and stable identifiers.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.assistant_models import AssistantOperationName, StructuredRecordItem
from app.models import (
    AircraftStatus,
    DataQualityAnomaly,
    InventoryStatus,
    MaintenanceStatus,
    RunwayStatus,
    StateSnapshot,
)
from app.replay_service import replay_service
from app.routers.data_fusion import FRESHNESS_POLICIES, _evaluate_data_quality
from app.state import state_store
from app.weather_service import weather_service


class AssistantQueryLayer:
    """
    Controlled query layer executing allowlisted, read-only queries against
    actual application datasets.
    """

    @staticmethod
    def _parse_iso(timestamp_str: Optional[str]) -> Optional[datetime]:
        if not timestamp_str:
            return None
        try:
            return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        except Exception:
            return None

    # -------------------------------------------------------------------------
    # 1. Maintenance Queries
    # -------------------------------------------------------------------------
    def get_overdue_maintenance(
        self,
        snapshot: StateSnapshot,
        now: datetime,
        limit: int = 20,
        airbase_id: Optional[str] = None,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Finds active maintenance work orders whose planned completion date is in the past."""
        limit = min(max(1, limit), 50)
        items: List[StructuredRecordItem] = []

        for wo in snapshot.maintenance_records:
            st = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
            if st in ("COMPLETED", "CANCELLED"):
                continue

            if airbase_id and wo.airbase_id.upper() != airbase_id.upper():
                continue

            planned_end = self._parse_iso(wo.planned_completion)
            is_overdue = planned_end and planned_end < now

            if is_overdue or st == "OVERDUE":
                overdue_hours = 0.0
                if planned_end:
                    overdue_hours = round((now - planned_end).total_seconds() / 3600.0, 1)

                reason = (
                    f"Due {wo.planned_completion} ({overdue_hours}h overdue); "
                    f"Status: {st}; Priority: {wo.priority.value if hasattr(wo.priority, 'value') else wo.priority}."
                )

                items.append(
                    StructuredRecordItem(
                        record_id=wo.record_id,
                        title=f"{wo.resource_id} ({wo.category.value if hasattr(wo.category, 'value') else wo.category})",
                        category="MAINTENANCE_WORK_ORDER",
                        status="OVERDUE",
                        severity="CRITICAL" if overdue_hours > 24 else "HIGH",
                        match_reason=reason,
                        source_module="MAINTENANCE",
                        timestamp=wo.planned_completion,
                        details={
                            "resource_id": wo.resource_id,
                            "airbase_id": wo.airbase_id,
                            "technician_lead": wo.technician_lead,
                            "planned_completion": wo.planned_completion,
                            "overdue_hours": overdue_hours,
                            "description": wo.description,
                        },
                        target_view="MAINTENANCE",
                        target_id=wo.record_id,
                    )
                )

        items = items[:limit]
        if not items:
            summary = "No overdue maintenance work orders found across the operational fleet."
        else:
            summary = f"Identified {len(items)} overdue maintenance work order(s) requiring immediate depot attention."

        return items, summary

    def get_maintenance_work_orders(
        self,
        snapshot: StateSnapshot,
        status_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        resource_id: Optional[str] = None,
        limit: int = 20,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Retrieves maintenance work orders with optional filtering."""
        limit = min(max(1, limit), 50)
        items: List[StructuredRecordItem] = []

        for wo in snapshot.maintenance_records:
            st = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
            pr = wo.priority.value if hasattr(wo.priority, "value") else str(wo.priority)

            if status_filter and st.upper() != status_filter.upper():
                continue
            if priority_filter and pr.upper() != priority_filter.upper():
                continue
            if resource_id and resource_id.upper() not in wo.resource_id.upper():
                continue

            sev = "CRITICAL" if pr == "CRITICAL" or st == "OVERDUE" else "HIGH" if pr == "HIGH" else "INFO"

            items.append(
                StructuredRecordItem(
                    record_id=wo.record_id,
                    title=f"{wo.resource_id} - {wo.description}",
                    category="MAINTENANCE_WORK_ORDER",
                    status=st,
                    severity=sev,
                    match_reason=f"Status: {st}; Priority: {pr}; Airbase: {wo.airbase_id}; Tech: {wo.technician_lead}.",
                    source_module="MAINTENANCE",
                    timestamp=wo.planned_start,
                    details={
                        "resource_id": wo.resource_id,
                        "category": str(wo.category),
                        "airbase_id": wo.airbase_id,
                        "technician_lead": wo.technician_lead,
                        "planned_start": wo.planned_start,
                        "planned_completion": wo.planned_completion,
                    },
                    target_view="MAINTENANCE",
                    target_id=wo.record_id,
                )
            )

        items = items[:limit]
        if not items:
            summary = "No maintenance work orders found matching the specified criteria."
        else:
            summary = f"Found {len(items)} maintenance work order(s) matching specified criteria."
        return items, summary

    # -------------------------------------------------------------------------
    # 2. Data Fusion & Quality Queries
    # -------------------------------------------------------------------------
    def get_stale_data_sources(
        self,
        snapshot: StateSnapshot,
        now: datetime,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Identifies data feeds exceeding freshness threshold policies."""
        report = _evaluate_data_quality(snapshot, now)
        items: List[StructuredRecordItem] = []

        for src in report.sources:
            if src.get("freshness") == "STALE":
                age = src.get("calculated_age_hours", 0.0)
                thresh = src.get("freshness_threshold_hours", 0.0)
                reason = (
                    f"Data age {age}h exceeds policy threshold of {thresh}h. "
                    f"Source: {src.get('source_type')}; Total records: {src.get('record_count')}."
                )

                items.append(
                    StructuredRecordItem(
                        record_id=f"FEED-{src.get('collection', '').upper()}",
                        title=src.get("name", "Unknown Feed"),
                        category="DATA_FEED_FRESHNESS",
                        status="STALE",
                        severity="WARNING" if age <= thresh * 2 else "CRITICAL",
                        match_reason=reason,
                        source_module="DATA_FUSION",
                        timestamp=src.get("last_updated"),
                        details=src,
                        target_view="DATA_FUSION",
                        target_id=src.get("collection"),
                    )
                )

        if not items:
            summary = "All 10 operational data feeds are currently FRESH and within SLA freshness thresholds."
        else:
            summary = f"Found {len(items)} stale dataset source(s) exceeding maximum freshness thresholds."

        return items, summary

    def get_data_quality_issues(
        self,
        snapshot: StateSnapshot,
        now: datetime,
        severity_filter: Optional[str] = None,
        category_filter: Optional[str] = None,
        limit: int = 25,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Detects schema, relational integrity, and business rule anomalies."""
        limit = min(max(1, limit), 50)
        report = _evaluate_data_quality(snapshot, now)
        items: List[StructuredRecordItem] = []

        for anom in report.anomalies:
            if severity_filter and anom.severity.upper() != severity_filter.upper():
                continue
            if category_filter and anom.category.upper() != category_filter.upper():
                continue

            reason = f"Rule: {anom.rule_name}. {anom.description} Recommendation: {anom.recommended_action}"

            items.append(
                StructuredRecordItem(
                    record_id=anom.anomaly_id,
                    title=f"{anom.category}: {anom.rule_name} on {anom.record_id}",
                    category="DATA_QUALITY_ANOMALY",
                    status="UNRESOLVED",
                    severity=anom.severity,
                    match_reason=reason,
                    source_module="DATA_FUSION",
                    timestamp=anom.detected_at,
                    details={
                        "rule_name": anom.rule_name,
                        "collection": anom.collection,
                        "record_id": anom.record_id,
                        "recommended_action": anom.recommended_action,
                    },
                    target_view="DATA_FUSION",
                    target_id=anom.anomaly_id,
                )
            )

        items = items[:limit]
        if not items:
            summary = "No data quality anomalies detected. Overall system trust score is 100%."
        else:
            summary = (
                f"Identified {len(items)} data quality issue(s). "
                f"Overall theatre trust score is {report.overall_quality_score}%."
            )

        return items, summary

    # -------------------------------------------------------------------------
    # 3. Aircraft & Airbase Reference Queries
    # -------------------------------------------------------------------------
    def get_aircraft_with_missing_references(
        self,
        snapshot: StateSnapshot,
        limit: int = 20,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Finds aircraft with broken, missing, or invalid foreign key references."""
        limit = min(max(1, limit), 50)
        airbase_ids = {b.id for b in snapshot.airbases}
        pilot_ids = {p.pilot_id for p in snapshot.pilots}
        items: List[StructuredRecordItem] = []

        for ac in snapshot.aircraft_fleet:
            broken_reasons = []

            # Airbase check
            if not ac.home_base_id:
                broken_reasons.append("Missing home_base_id reference (null or empty).")
            elif ac.home_base_id not in airbase_ids:
                broken_reasons.append(
                    f"Invalid home_base_id '{ac.home_base_id}' (does not exist in registered airbases)."
                )

            # Pilot assignment check
            assigned_pilots = [p for p in snapshot.pilots if p.assigned_aircraft_id == ac.aircraft_id]
            if len(assigned_pilots) > 1:
                broken_reasons.append(f"Multiple pilots assigned to single airframe: {[p.name for p in assigned_pilots]}.")

            if broken_reasons:
                items.append(
                    StructuredRecordItem(
                        record_id=ac.aircraft_id,
                        title=f"{ac.callsign} ({ac.model})",
                        category="RELATIONAL_INTEGRITY",
                        status="INVALID_REFERENCE",
                        severity="CRITICAL",
                        match_reason="; ".join(broken_reasons),
                        source_module="AIRCRAFT",
                        timestamp=snapshot.last_updated,
                        details={
                            "callsign": ac.callsign,
                            "model": ac.model,
                            "home_base_id": ac.home_base_id,
                            "status": ac.status.value if hasattr(ac.status, "value") else ac.status,
                            "valid_airbases_count": len(airbase_ids),
                        },
                        target_view="DASHBOARD",
                        target_id=ac.aircraft_id,
                    )
                )

        items = items[:limit]
        if not items:
            summary = f"All {len(snapshot.aircraft_fleet)} aircraft records have verified, valid airbase and pilot references."
        else:
            summary = f"Found {len(items)} aircraft record(s) with missing or invalid relational references."

        return items, summary

    def get_aircraft_readiness_summary(
        self,
        snapshot: StateSnapshot,
        status_filter: Optional[str] = None,
        model_filter: Optional[str] = None,
        limit: int = 25,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Summarizes combat fleet readiness and flags incomplete technical parameters."""
        limit = min(max(1, limit), 50)
        items: List[StructuredRecordItem] = []

        status_counts = {"READY": 0, "MAINTENANCE": 0, "AIRBORNE": 0, "ABORTED": 0}

        for ac in snapshot.aircraft_fleet:
            st = ac.status.value if hasattr(ac.status, "value") else str(ac.status)
            status_counts[st] = status_counts.get(st, 0) + 1

            if status_filter and st.upper() != status_filter.upper():
                continue
            if model_filter and model_filter.upper() not in ac.model.upper():
                continue

            # Check incomplete telemetry
            incomplete_notes = []
            if ac.fuel_burn_liters_per_km <= 0:
                incomplete_notes.append("Invalid fuel burn rate (<=0)")
            if ac.cruise_speed_kmph <= 0:
                incomplete_notes.append("Invalid cruise speed (<=0)")
            if ac.current_fuel_pct <= 0:
                incomplete_notes.append("Fuel tank empty (0%)")

            severity = "WARNING" if incomplete_notes else "INFO"
            reason = f"Status: {st}; Fuel: {ac.current_fuel_pct}%; Base: {ac.home_base_id}; Weapons: {ac.total_equipped_weapons_count} equipped."
            if incomplete_notes:
                reason += f" Incomplete telemetry: {', '.join(incomplete_notes)}."

            items.append(
                StructuredRecordItem(
                    record_id=ac.aircraft_id,
                    title=f"{ac.callsign} - {ac.model}",
                    category="AIRCRAFT_READINESS",
                    status=st,
                    severity=severity,
                    match_reason=reason,
                    source_module="AIRCRAFT",
                    timestamp=snapshot.last_updated,
                    details={
                        "model": ac.model,
                        "callsign": ac.callsign,
                        "status": st,
                        "current_fuel_pct": ac.current_fuel_pct,
                        "max_range_km": ac.max_range_km,
                        "home_base_id": ac.home_base_id,
                    },
                    target_view="DASHBOARD",
                    target_id=ac.aircraft_id,
                )
            )

        items = items[:limit]
        summary = (
            f"Fleet Readiness: {status_counts.get('READY', 0)} READY, "
            f"{status_counts.get('AIRBORNE', 0)} AIRBORNE, "
            f"{status_counts.get('MAINTENANCE', 0)} in MAINTENANCE, "
            f"{status_counts.get('ABORTED', 0)} ABORTED (Total: {len(snapshot.aircraft_fleet)} airframes)."
        )

        return items, summary

    # -------------------------------------------------------------------------
    # 4. Inventory Shortages Queries
    # -------------------------------------------------------------------------
    def get_inventory_shortages(
        self,
        snapshot: StateSnapshot,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Identifies support spare parts and munitions inventory below reorder thresholds."""
        limit = min(max(1, limit), 50)
        items: List[StructuredRecordItem] = []

        # 1. Ground support spares & LRUs
        for item in snapshot.support_inventory:
            cat_str = item.category.value if hasattr(item.category, "value") else str(item.category)
            if category and category.upper() not in cat_str.upper():
                continue

            on_hand = item.quantity_on_hand
            reorder = item.reorder_threshold
            reserved = item.reserved_quantity

            is_critical = on_hand <= 1 or reserved > on_hand
            is_low = on_hand <= reorder

            if is_critical or is_low or item.status == InventoryStatus.CRITICAL_REORDER:
                deficit = max(0, reorder - on_hand)
                reason = (
                    f"Stock on-hand: {on_hand} {item.unit} (Threshold: {reorder}, Reserved: {reserved}, Deficit: -{deficit}). "
                    f"Airbase: {item.airbase_id}; Supplier lead time: {item.supplier_lead_time_days} days."
                )

                items.append(
                    StructuredRecordItem(
                        record_id=item.item_id,
                        title=f"{item.item_name} ({cat_str})",
                        category="SUPPORT_INVENTORY",
                        status="CRITICAL_DEPLETION" if is_critical else "LOW_STOCK",
                        severity="CRITICAL" if is_critical else "WARNING",
                        match_reason=reason,
                        source_module="INVENTORY",
                        timestamp=item.last_audit,
                        details={
                            "item_name": item.item_name,
                            "airbase_id": item.airbase_id,
                            "quantity_on_hand": on_hand,
                            "reorder_threshold": reorder,
                            "reserved_quantity": reserved,
                            "deficit": deficit,
                        },
                        target_view="MAINTENANCE",
                        target_id=item.item_id,
                    )
                )

        # 2. Weapons with low stock (e.g. <= 20)
        for wep in snapshot.weapons_inventory:
            if category and category.upper() not in str(wep.category).upper():
                continue

            if wep.stock_count <= 20:
                reason = (
                    f"Munition reserve at {wep.stock_count} units. "
                    f"Weight: {wep.weight_kg}kg; Range: {wep.effective_range_km}km; Guidance: {wep.guidance_type.value if hasattr(wep.guidance_type, 'value') else wep.guidance_type}."
                )
                items.append(
                    StructuredRecordItem(
                        record_id=wep.weapon_id,
                        title=f"{wep.name} ({wep.category.value if hasattr(wep.category, 'value') else wep.category})",
                        category="WEAPONS_MUNITIONS",
                        status="DEPLETED" if wep.stock_count == 0 else "LOW_RESERVE",
                        severity="CRITICAL" if wep.stock_count <= 10 else "WARNING",
                        match_reason=reason,
                        source_module="INVENTORY",
                        timestamp=snapshot.last_updated,
                        details={
                            "name": wep.name,
                            "category": str(wep.category),
                            "stock_count": wep.stock_count,
                            "effective_range_km": wep.effective_range_km,
                        },
                        target_view="DASHBOARD",
                        target_id=wep.weapon_id,
                    )
                )

        items = items[:limit]
        if not items:
            summary = "All depot line-replaceable units, ground support items, and munitions are adequately stocked."
        else:
            summary = f"Identified {len(items)} inventory item(s) currently below safety reorder thresholds."

        return items, summary

    # -------------------------------------------------------------------------
    # 5. Simulation & Replay Queries
    # -------------------------------------------------------------------------
    def get_latest_simulation_summary(
        self,
        snapshot: StateSnapshot,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Summarizes findings and delta metrics from the most recent scenario simulation."""
        items: List[StructuredRecordItem] = []

        # Check for active scenario comparison in snapshot
        if snapshot.active_scenario_comparison:
            comp = snapshot.active_scenario_comparison
            for m in comp.metrics:
                items.append(
                    StructuredRecordItem(
                        record_id=f"METRIC-{m.metric_name.replace(' ', '_').upper()}",
                        title=f"{m.metric_name}: {m.baseline_value} -> {m.simulated_value} {m.unit}",
                        category="SIMULATION_METRIC_DELTA",
                        status=m.impact,
                        severity="CRITICAL" if m.impact == "DEGRADED" else "INFO",
                        match_reason=f"Scenario delta: {m.delta:+g} {m.unit}. Category: {m.category}.",
                        source_module="SIMULATION",
                        timestamp=comp.applied_at,
                        details={
                            "scenario_name": comp.scenario_name,
                            "baseline": m.baseline_value,
                            "simulated": m.simulated_value,
                            "delta": m.delta,
                        },
                        target_view="REPLAY",
                        target_id=comp.scenario_id,
                    )
                )

            summary = (
                f"Active simulation '{comp.scenario_name}' applied at {comp.applied_at}. "
                f"Generated {len(comp.metrics)} metric deltas with {len(comp.conflicts_detected)} operational conflict(s)."
            )
            return items, summary

        # Check recorded replay sessions
        sessions = replay_service.list_sessions()
        if sessions:
            latest = sessions[0]
            summary_reason = (
                f"Session: {latest.scenario_name} (ID: {latest.session_id}). "
                f"Recorded {latest.event_count} events with {latest.critical_count} critical alert(s) and {latest.warnings_count} warning(s)."
            )

            items.append(
                StructuredRecordItem(
                    record_id=latest.session_id,
                    title=latest.scenario_name,
                    category="RECORDED_REPLAY_SESSION",
                    status=latest.status,
                    severity="CRITICAL" if latest.critical_count > 0 else "INFO",
                    match_reason=summary_reason,
                    source_module="SIMULATION",
                    timestamp=latest.start_time,
                    details={
                        "event_count": latest.event_count,
                        "critical_count": latest.critical_count,
                        "warnings_count": latest.warnings_count,
                        "duration_seconds": latest.duration_seconds,
                    },
                    target_view="REPLAY",
                    target_id=latest.session_id,
                )
            )

            summary = f"Latest recorded scenario is '{latest.scenario_name}' with {latest.event_count} recorded events."
            return items, summary

        return [], "No active or recorded scenario simulation sessions found."

    def get_recent_simulation_events(
        self,
        snapshot: StateSnapshot,
        limit: int = 15,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Queries recorded chronological event log entries."""
        limit = min(max(1, limit), 50)
        items: List[StructuredRecordItem] = []

        reversed_logs = list(reversed(snapshot.event_log))
        for evt in reversed_logs:
            ev_type_str = str(evt.event_type.value if hasattr(evt.event_type, "value") else evt.event_type)
            ev_sev = str(evt.severity)

            if severity and ev_sev.upper() != severity.upper():
                continue
            if event_type and event_type.upper() not in ev_type_str.upper():
                continue

            reason = f"Type: {ev_type_str}; Source: {evt.source}; Severity: {ev_sev}. Affected: {', '.join(evt.affected_assets) if evt.affected_assets else 'None'}."
            if evt.retasking_actions:
                reason += f" Actions: {len(evt.retasking_actions)} dynamic re-plans executed."

            items.append(
                StructuredRecordItem(
                    record_id=evt.event_id,
                    title=f"{ev_type_str}: {evt.description[:65]}...",
                    category="EVENT_LOG_ENTRY",
                    status="LOGGED",
                    severity=ev_sev,
                    match_reason=reason,
                    source_module="AUDIT",
                    timestamp=evt.timestamp,
                    details={
                        "event_type": ev_type_str,
                        "source": evt.source,
                        "affected_assets": evt.affected_assets,
                        "retask_actions_count": len(evt.retasking_actions),
                    },
                    target_view="AUDIT",
                    target_id=evt.event_id,
                )
            )

        items = items[:limit]
        summary = f"Retrieved {len(items)} chronological tactical event log record(s)."
        return items, summary

    # -------------------------------------------------------------------------
    # 6. Weather & Environmental Risk Queries
    # -------------------------------------------------------------------------
    async def get_weather_alerts(
        self,
        snapshot: StateSnapshot,
        high_risk_only: bool = False,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Queries active weather warnings and environmental risk assessments across airbases."""
        items: List[StructuredRecordItem] = []

        try:
            airbases_data, alerts = await weather_service.get_theatre_weather(
                snapshot.airbases, force_refresh=False
            )
        except Exception as e:
            return [], f"Weather service temporarily unavailable: {str(e)}"

        # 1. Weather alerts
        for al in alerts:
            sev = al.severity.value if hasattr(al.severity, "value") else str(al.severity)
            cat = al.category.value if hasattr(al.category, "value") else str(al.category)

            if high_risk_only and sev not in ("CRITICAL", "WARNING"):
                continue

            reason = (
                f"Airbase: {al.airbase_name}; Category: {cat}; "
                f"Trigger: {al.triggering_variable} = {al.measured_value} (Threshold: {al.threshold_value}). "
                f"Source: {al.data_source}."
            )

            items.append(
                StructuredRecordItem(
                    record_id=al.alert_id,
                    title=f"{al.airbase_name}: {al.message}",
                    category="METEOROLOGICAL_ALERT",
                    status="ACTIVE",
                    severity=sev,
                    match_reason=reason,
                    source_module="WEATHER",
                    timestamp=al.observation_timestamp,
                    details={
                        "airbase_id": al.airbase_id,
                        "airbase_name": al.airbase_name,
                        "category": cat,
                        "measured_value": al.measured_value,
                        "threshold_value": al.threshold_value,
                        "data_source": al.data_source,
                    },
                    target_view="WEATHER",
                    target_id=al.airbase_id,
                )
            )

        # 2. Airbase Risk Assessments
        simulated_count = 0
        for ab in airbases_data:
            risk = ab.risk_assessment.overall_risk.value if hasattr(ab.risk_assessment.overall_risk, "value") else str(ab.risk_assessment.overall_risk)
            if ab.is_synthetic:
                simulated_count += 1

            if risk in ("HIGH", "MODERATE"):
                factors_desc = "; ".join(f.factor for f in ab.risk_assessment.contributing_factors[:2])
                sim_notice = " [SYNTHETIC SCENARIO INJECTED]" if ab.is_synthetic else " [LIVE OPEN-METEO]"
                reason = f"Overall Risk: {risk}{sim_notice}. {ab.risk_assessment.summary_assessment} Factors: {factors_desc or 'None'}."

                items.append(
                    StructuredRecordItem(
                        record_id=f"WX-{ab.airbase_id}",
                        title=f"{ab.airbase_name} - Risk {risk}{sim_notice}",
                        category="AIRBASE_WEATHER_RISK",
                        status=risk,
                        severity="CRITICAL" if risk == "HIGH" else "WARNING",
                        match_reason=reason,
                        source_module="WEATHER",
                        timestamp=ab.observation_time,
                        details={
                            "airbase_id": ab.airbase_id,
                            "airbase_name": ab.airbase_name,
                            "overall_risk": risk,
                            "is_synthetic": ab.is_synthetic,
                            "factors_count": len(ab.risk_assessment.contributing_factors),
                        },
                        target_view="WEATHER",
                        target_id=ab.airbase_id,
                    )
                )

        if not items:
            summary = "All monitored airbases report nominal weather conditions with no active alerts."
        else:
            sim_info = f" ({simulated_count} airbase(s) under synthetic weather injection)" if simulated_count > 0 else " (All live Open-Meteo observations)"
            summary = f"Detected {len(items)} active weather alert(s) and elevated risk airbase(s){sim_info}."

        return items, summary

    # -------------------------------------------------------------------------
    # 7. Composite Triage Query: Records Needing Attention
    # -------------------------------------------------------------------------
    async def get_records_needing_attention(
        self,
        snapshot: StateSnapshot,
        now: datetime,
        limit: int = 25,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Triage composite: aggregates critical overdue maintenance, high weather alerts,
        stale sources, broken references, and inventory stockouts."""
        limit = min(max(1, limit), 50)
        triage_items: List[StructuredRecordItem] = []

        # 1. Overdue maintenance
        maint_items, _ = self.get_overdue_maintenance(snapshot, now, limit=10)
        triage_items.extend(maint_items)

        # 2. Broken aircraft references
        ref_items, _ = self.get_aircraft_with_missing_references(snapshot, limit=5)
        triage_items.extend(ref_items)

        # 3. Inventory critical shortages
        inv_items, _ = self.get_inventory_shortages(snapshot, limit=5)
        critical_inv = [i for i in inv_items if i.severity == "CRITICAL"]
        triage_items.extend(critical_inv)

        # 4. Stale feeds
        stale_items, _ = self.get_stale_data_sources(snapshot, now)
        triage_items.extend(stale_items)

        # 5. High weather alerts
        wx_items, _ = await self.get_weather_alerts(snapshot, high_risk_only=True)
        triage_items.extend(wx_items[:5])

        # 6. Blocked airbases
        for ab in snapshot.airbases:
            st = ab.runway_status.value if hasattr(ab.runway_status, "value") else str(ab.runway_status)
            if st == "BLOCKED":
                triage_items.append(
                    StructuredRecordItem(
                        record_id=ab.id,
                        title=f"{ab.name} (Runway BLOCKED)",
                        category="AIRBASE_INFRASTRUCTURE",
                        status="BLOCKED",
                        severity="CRITICAL",
                        match_reason=f"Runway locked out. Available fuel reserve: {ab.available_fuel_liters:,.0f} L.",
                        source_module="AIRBASE",
                        timestamp=snapshot.last_updated,
                        details={"airbase_id": ab.id, "runway_status": st},
                        target_view="MAP",
                        target_id=ab.id,
                    )
                )

        # Deduplicate by record_id and sort by severity
        seen_ids = set()
        deduped: List[StructuredRecordItem] = []
        severity_rank = {"CRITICAL": 0, "HIGH": 1, "WARNING": 2, "OVERDUE": 0, "INFO": 3, "NOMINAL": 4}

        for it in triage_items:
            if it.record_id not in seen_ids:
                seen_ids.add(it.record_id)
                deduped.append(it)

        deduped.sort(key=lambda x: severity_rank.get(x.severity, 5))
        deduped = deduped[:limit]

        if not deduped:
            summary = "Operational theatre status is optimal. No critical anomalies, overdue orders, or alerts require attention."
        else:
            summary = f"Flagged {len(deduped)} operational record(s) requiring immediate command attention across maintenance, infrastructure, and logistics."

        return deduped, summary

    # -------------------------------------------------------------------------
    # 8. Airbase Status Query
    # -------------------------------------------------------------------------
    def get_airbase_status(
        self,
        snapshot: StateSnapshot,
        airbase_id: Optional[str] = None,
    ) -> Tuple[List[StructuredRecordItem], str]:
        """Returns runway and fuel availability for airbases."""
        items: List[StructuredRecordItem] = []

        for ab in snapshot.airbases:
            if airbase_id and ab.id.upper() != airbase_id.upper() and airbase_id.upper() not in ab.name.upper():
                continue

            st = ab.runway_status.value if hasattr(ab.runway_status, "value") else str(ab.runway_status)
            stationed_jets = [ac.callsign for ac in snapshot.aircraft_fleet if ac.home_base_id == ab.id]
            stored_weps = sum(w.quantity for w in ab.stored_weapons)

            reason = (
                f"Runway: {st}; Fuel: {ab.available_fuel_liters:,.0f} L; "
                f"Stationed Aircraft ({len(stationed_jets)}): {', '.join(stationed_jets[:3]) or 'None'}; "
                f"Armory Stock: {stored_weps} weapons."
            )

            items.append(
                StructuredRecordItem(
                    record_id=ab.id,
                    title=f"{ab.name} ({st})",
                    category="AIRBASE_STATUS",
                    status=st,
                    severity="CRITICAL" if st == "BLOCKED" else "INFO",
                    match_reason=reason,
                    source_module="AIRBASE",
                    timestamp=snapshot.last_updated,
                    details={
                        "runway_status": st,
                        "fuel_liters": ab.available_fuel_liters,
                        "stationed_count": len(stationed_jets),
                    },
                    target_view="MAP",
                    target_id=ab.id,
                )
            )

        summary = f"Retrieved status for {len(items)} forward airbase(s)."
        return items, summary


# Singleton instance
assistant_query_layer = AssistantQueryLayer()
