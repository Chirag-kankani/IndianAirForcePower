"""
Thread-safe In-Memory StateStore for AirPower Decision-Support Platform.
Acts as the single source of truth across all REST endpoints and WebSockets.
"""
from __future__ import annotations

import asyncio
import copy
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from app.models import (
    ActiveMission,
    Airbase,
    Aircraft,
    AircraftStatus,
    ApprovalRequest,
    EventLogEntry,
    MaintenanceRecord,
    MissionStatus,
    MissionTarget,
    Pilot,
    RunwayStatus,
    ScenarioComparison,
    ScenarioComparisonMetric,
    StateSnapshot,
    SupportInventory,
    ThreatZone,
    Weapon,
)


class StateStore:
    """
    In-memory state container with asyncio Lock for thread-safe mutations.
    """

    def __init__(self, data_file_path: Optional[Path] = None):
        self._lock = asyncio.Lock()
        self.data_file_path = (
            data_file_path
            or Path(__file__).parent.parent / "data" / "mock_data.json"
        )
        self._snapshot: Optional[StateSnapshot] = None
        self._initial_raw_data: Optional[Dict[str, Any]] = None
        self._baseline_snapshot: Optional[StateSnapshot] = None
        self.load_from_disk()

    def load_from_disk(self) -> None:
        """Loads state from the mock_data.json file."""
        if not self.data_file_path.exists():
            from app.data_generator import save_mock_data
            save_mock_data(self.data_file_path, seed=42)

        with open(self.data_file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        self._initial_raw_data = copy.deepcopy(raw_data)
        self._snapshot = StateSnapshot.model_validate(raw_data)
        self._baseline_snapshot = StateSnapshot.model_validate(copy.deepcopy(raw_data))
        self._snapshot.last_updated = datetime.now(timezone.utc).isoformat()

    def capture_baseline(self) -> StateSnapshot:
        """Explicitly capture the current state snapshot as reference baseline."""
        if self._snapshot:
            self._baseline_snapshot = self._snapshot.model_copy(deep=True)
        return self._baseline_snapshot or self.get_snapshot()

    def get_baseline(self) -> StateSnapshot:
        """Returns the baseline snapshot."""
        if self._baseline_snapshot is None:
            self.load_from_disk()
        assert self._baseline_snapshot is not None
        return self._baseline_snapshot.model_copy(deep=True)

    def compute_scenario_comparison(
        self, scenario_name: str, affected_assets: Optional[List[str]] = None
    ) -> ScenarioComparison:
        """
        Calculates side-by-side delta metrics, detected resource conflicts,
        and affected records between reference baseline and current simulated state.
        """
        baseline = self.get_baseline()
        current = self.get_snapshot()
        applied_at = datetime.now(timezone.utc).isoformat()
        affected_assets = affected_assets or []

        # 1. Metric: Fleet Readiness %
        base_ready = sum(1 for a in baseline.aircraft_fleet if a.status == AircraftStatus.READY)
        curr_ready = sum(1 for a in current.aircraft_fleet if a.status == AircraftStatus.READY)
        base_total_jets = max(1, len(baseline.aircraft_fleet))
        curr_total_jets = max(1, len(current.aircraft_fleet))
        base_readiness_pct = round((base_ready / base_total_jets) * 100.0, 1)
        curr_readiness_pct = round((curr_ready / curr_total_jets) * 100.0, 1)
        readiness_delta = round(curr_readiness_pct - base_readiness_pct, 1)

        # 2. Metric: Ready Aircraft Count
        ready_delta = curr_ready - base_ready

        # 3. Metric: Active/Airborne Sorties
        base_active = len(baseline.active_missions)
        curr_active = len(current.active_missions)
        active_delta = curr_active - base_active

        # 4. Metric: Operational Airbases
        base_op_bases = sum(1 for b in baseline.airbases if b.runway_status == RunwayStatus.OPERATIONAL)
        curr_op_bases = sum(1 for b in current.airbases if b.runway_status == RunwayStatus.OPERATIONAL)
        bases_delta = curr_op_bases - base_op_bases

        # 5. Metric: Available Base Fuel (kL)
        base_fuel_kl = round(sum(b.available_fuel_liters for b in baseline.airbases) / 1000.0, 1)
        curr_fuel_kl = round(sum(b.available_fuel_liters for b in current.airbases) / 1000.0, 1)
        fuel_delta = round(curr_fuel_kl - base_fuel_kl, 1)

        # 6. Metric: Open Maintenance Work Orders
        base_open_wo = sum(1 for w in baseline.maintenance_records if w.status in ("OPEN", "IN_PROGRESS", "OVERDUE"))
        curr_open_wo = sum(1 for w in current.maintenance_records if w.status in ("OPEN", "IN_PROGRESS", "OVERDUE"))
        wo_delta = curr_open_wo - base_open_wo

        # 7. Metric: Threat Zones Active
        base_threats = len(baseline.threat_environment)
        curr_threats = len(current.threat_environment)
        threats_delta = curr_threats - base_threats

        metrics = [
            ScenarioComparisonMetric(
                metric_name="Fleet Combat Readiness",
                category="READINESS",
                baseline_value=base_readiness_pct,
                simulated_value=curr_readiness_pct,
                delta=readiness_delta,
                unit="%",
                impact="IMPROVED" if readiness_delta > 0 else ("DEGRADED" if readiness_delta < 0 else "NEUTRAL"),
            ),
            ScenarioComparisonMetric(
                metric_name="Ready Combat Airframes",
                category="ASSETS",
                baseline_value=float(base_ready),
                simulated_value=float(curr_ready),
                delta=float(ready_delta),
                unit="A/C",
                impact="IMPROVED" if ready_delta > 0 else ("DEGRADED" if ready_delta < 0 else "NEUTRAL"),
            ),
            ScenarioComparisonMetric(
                metric_name="Active Deployed Sorties",
                category="OPERATIONS",
                baseline_value=float(base_active),
                simulated_value=float(curr_active),
                delta=float(active_delta),
                unit="sorties",
                impact="NEUTRAL",
            ),
            ScenarioComparisonMetric(
                metric_name="Operational Airbases",
                category="INFRASTRUCTURE",
                baseline_value=float(base_op_bases),
                simulated_value=float(curr_op_bases),
                delta=float(bases_delta),
                unit="bases",
                impact="IMPROVED" if bases_delta > 0 else ("DEGRADED" if bases_delta < 0 else "NEUTRAL"),
            ),
            ScenarioComparisonMetric(
                metric_name="Operational Fuel Reserves",
                category="LOGISTICS",
                baseline_value=base_fuel_kl,
                simulated_value=curr_fuel_kl,
                delta=fuel_delta,
                unit="kL",
                impact="IMPROVED" if fuel_delta > 0 else ("DEGRADED" if fuel_delta < 0 else "NEUTRAL"),
            ),
            ScenarioComparisonMetric(
                metric_name="Active Maintenance Workload",
                category="MAINTENANCE",
                baseline_value=float(base_open_wo),
                simulated_value=float(curr_open_wo),
                delta=float(wo_delta),
                unit="tasks",
                impact="DEGRADED" if wo_delta > 0 else ("IMPROVED" if wo_delta < 0 else "NEUTRAL"),
            ),
            ScenarioComparisonMetric(
                metric_name="Theatre Threat Zones",
                category="ENVIRONMENT",
                baseline_value=float(base_threats),
                simulated_value=float(curr_threats),
                delta=float(threats_delta),
                unit="zones",
                impact="DEGRADED" if threats_delta > 0 else "NEUTRAL",
            ),
        ]

        # Conflict Detection
        conflicts: List[str] = []
        for base in current.airbases:
            if base.runway_status == RunwayStatus.BLOCKED:
                grounded_jets = [a for a in current.aircraft_fleet if a.home_base_id == base.id and a.status == AircraftStatus.READY]
                conflicts.append(
                    f"Runway lockout at {base.name}: {len(grounded_jets)} assigned aircraft immobilized from taking off."
                )

        for ac in current.aircraft_fleet:
            if ac.status == AircraftStatus.ABORTED:
                conflicts.append(
                    f"Aircraft {ac.callsign} ({ac.model}) aborted flight due to equipment anomaly — emergency turnaround initiated."
                )

        if len(current.threat_environment) > len(baseline.threat_environment):
            new_threats = [t for t in current.threat_environment if t.threat_id not in {b.threat_id for b in baseline.threat_environment}]
            for nt in new_threats:
                conflicts.append(
                    f"New dynamic threat zone '{nt.name}' intersects tactical transit airspace (Severity: {nt.threat_severity}/5)."
                )

        # Identify changed records
        affected_records: List[Dict[str, Any]] = []

        # Check aircraft
        for ac in current.aircraft_fleet:
            b_ac = next((a for a in baseline.aircraft_fleet if a.aircraft_id == ac.aircraft_id), None)
            if b_ac and (b_ac.status != ac.status or ac.aircraft_id in affected_assets):
                affected_records.append({
                    "entity_type": "AIRCRAFT",
                    "entity_id": ac.aircraft_id,
                    "label": f"{ac.callsign} ({ac.model})",
                    "baseline_state": b_ac.status.value,
                    "simulated_state": ac.status.value,
                    "notes": f"Status shifted from {b_ac.status.value} to {ac.status.value} during simulation.",
                })

        # Check airbases
        for b in current.airbases:
            b_base = next((bb for bb in baseline.airbases if bb.id == b.id), None)
            if b_base and (b_base.runway_status != b.runway_status or b.id in affected_assets):
                affected_records.append({
                    "entity_type": "AIRBASE",
                    "entity_id": b.id,
                    "label": b.name,
                    "baseline_state": b_base.runway_status.value,
                    "simulated_state": b.runway_status.value,
                    "notes": f"Runway status transitioned from {b_base.runway_status.value} to {b.runway_status.value}.",
                })

        # Check new threats
        for t in current.threat_environment:
            if not any(bt.threat_id == t.threat_id for bt in baseline.threat_environment):
                affected_records.append({
                    "entity_type": "THREAT_ZONE",
                    "entity_id": t.threat_id,
                    "label": t.name,
                    "baseline_state": "NONE",
                    "simulated_state": f"ACTIVE (Radius {t.effective_radius_km}km)",
                    "notes": f"Spawned SAM/EW threat pop-up at {t.center_location.lat:.2f}N, {t.center_location.lng:.2f}E.",
                })

        comparison = ScenarioComparison(
            scenario_id=f"SIM-{uuid.uuid4().hex[:6].upper()}" if 'uuid' in globals() else f"SIM-{int(datetime.now(timezone.utc).timestamp())}",
            scenario_name=scenario_name,
            applied_at=applied_at,
            metrics=metrics,
            affected_records=affected_records,
            conflicts_detected=conflicts,
            status="SIMULATED",
        )

        if self._snapshot:
            self._snapshot.active_scenario_comparison = comparison

        return comparison

    def reset_to_initial(self) -> StateSnapshot:
        """Resets the state back to the original seeded dataset."""
        if self._initial_raw_data:
            self._snapshot = StateSnapshot.model_validate(copy.deepcopy(self._initial_raw_data))
            self._snapshot.active_scenario_comparison = None
            self._snapshot.last_updated = datetime.now(timezone.utc).isoformat()
            self._baseline_snapshot = StateSnapshot.model_validate(copy.deepcopy(self._initial_raw_data))
            return self.get_snapshot()
        self.load_from_disk()
        return self.get_snapshot()

    def get_snapshot(self) -> StateSnapshot:
        """Returns a snapshot of the current state."""
        if self._snapshot is None:
            self.load_from_disk()
        assert self._snapshot is not None
        return self._snapshot.model_copy(deep=True)

    async def get_snapshot_async(self) -> StateSnapshot:
        async with self._lock:
            return self.get_snapshot()

    async def mutate(self, mutator_fn: Callable[[StateSnapshot], Any]) -> Any:
        """
        Safely execute a mutation callable under the asyncio lock.
        The mutator receives a mutable reference to current StateSnapshot.
        """
        async with self._lock:
            if self._snapshot is None:
                self.load_from_disk()
            assert self._snapshot is not None
            result = mutator_fn(self._snapshot)
            self._snapshot.last_updated = datetime.now(timezone.utc).isoformat()
            return result

    # Helper query methods
    def get_aircraft(self, aircraft_id: str) -> Optional[Aircraft]:
        if not self._snapshot:
            return None
        return next((a for a in self._snapshot.aircraft_fleet if a.aircraft_id == aircraft_id), None)

    def get_airbase(self, base_id: str) -> Optional[Airbase]:
        if not self._snapshot:
            return None
        return next((b for b in self._snapshot.airbases if b.id == base_id), None)

    def get_pilot(self, pilot_id: str) -> Optional[Pilot]:
        if not self._snapshot:
            return None
        return next((p for p in self._snapshot.pilots if p.pilot_id == pilot_id), None)

    def get_weapon(self, weapon_id: str) -> Optional[Weapon]:
        if not self._snapshot:
            return None
        return next((w for w in self._snapshot.weapons_inventory if w.weapon_id == weapon_id), None)

    def get_target(self, target_id: str) -> Optional[MissionTarget]:
        if not self._snapshot:
            return None
        return next((t for t in self._snapshot.mission_targets if t.target_id == target_id), None)

    def get_maintenance_record(self, record_id: str) -> Optional[MaintenanceRecord]:
        if not self._snapshot:
            return None
        return next((m for m in self._snapshot.maintenance_records if m.record_id == record_id), None)

    def get_inventory_item(self, item_id: str) -> Optional[SupportInventory]:
        if not self._snapshot:
            return None
        return next((i for i in self._snapshot.support_inventory if i.item_id == item_id), None)

    def get_approval_request(self, approval_id: str) -> Optional[ApprovalRequest]:
        if not self._snapshot:
            return None
        return next((a for a in self._snapshot.approval_requests if a.approval_id == approval_id), None)


# Global singleton instance
state_store = StateStore()
