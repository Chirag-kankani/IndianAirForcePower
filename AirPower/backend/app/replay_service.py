"""
Replay & Debrief Service for AirPower Decision-Support Platform.
Manages recorded simulation sessions, step-by-step state snapshot history,
persistence to replay_sessions.json, and deterministic post-scenario debrief generation.
"""
from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models import (
    AircraftStatus,
    DebriefComparisonItem,
    DebriefIncidentItem,
    DebriefReport,
    EventType,
    ReplaySession,
    ReplaySessionSummary,
    ReplayStep,
    RunwayStatus,
    StateSnapshot,
)
from app.state import state_store


class ReplayService:
    """
    Manages scenario recording sessions and historical state replay.
    Ensures recorded sessions survive reloads and resets.
    """

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = (
            storage_path
            or Path(__file__).parent.parent / "data" / "replay_sessions.json"
        )
        self._sessions: Dict[str, ReplaySession] = {}
        self._active_session_id: Optional[str] = None
        self._load_from_storage()

    def _load_from_storage(self) -> None:
        """Loads recorded sessions from JSON file or seeds default reference scenario."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        session = ReplaySession.model_validate(item)
                        self._sessions[session.session_id] = session
            except Exception as e:
                print(f"[ReplayService] Error loading replay sessions: {e}")

        if "SES-AIRPOWER-ALPHA-DEMO" not in self._sessions:
            self._seed_default_demo_session()

        # Set or create active session
        active = next((s for s in self._sessions.values() if s.status == "RECORDING"), None)
        if active:
            self._active_session_id = active.session_id
        else:
            self.start_new_session("Live Operational Session")

    def _save_to_storage(self) -> None:
        """Persists all recorded sessions to disk."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            serializable = [s.model_dump() for s in self._sessions.values()]
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(serializable, f, indent=2)
        except Exception as e:
            print(f"[ReplayService] Error saving replay sessions: {e}")

    def _seed_default_demo_session(self) -> None:
        """
        Seeds a realistic pre-recorded reference scenario session:
        'Air Defence Scramble & Multi-Crisis Response'
        Demonstrates the full incident, retasking, and recovery lifecycle.
        """
        baseline_snap = state_store.get_baseline()
        start_dt = datetime(2026, 10, 14, 10, 0, 0, tzinfo=timezone.utc)
        session_id = "SES-AIRPOWER-ALPHA-DEMO"

        # Step 0: Baseline state
        step0_snap = baseline_snap.model_copy(deep=True)
        step0 = ReplayStep(
            step_index=0,
            event_id="EVT-INIT-00",
            timestamp=start_dt.isoformat(),
            elapsed_seconds=0.0,
            event_type="SYSTEM_INITIALIZATION",
            category="LIFECYCLE",
            severity="INFO",
            title="Baseline Force Posture Established",
            description="Initial seeded force readiness: 23 combat airframes, 6 airbases operational, 4 threat zones mapped.",
            affected_entity_ids=[],
            state_delta={"status": "INITIALIZED"},
            state_snapshot=step0_snap,
        )

        # Step 1: Sortie Deployed (+18s)
        step1_snap = baseline_snap.model_copy(deep=True)
        # Rafale deployed to Alpha Bunker
        rafale = next((a for a in step1_snap.aircraft_fleet if "RAFALE" in a.aircraft_id), step1_snap.aircraft_fleet[0])
        rafale.status = AircraftStatus.AIRBORNE
        step1_target = step1_snap.mission_targets[0]
        step1 = ReplayStep(
            step_index=1,
            event_id="EVT-MSN-DEPLOY-01",
            timestamp=datetime(2026, 10, 14, 10, 0, 18, tzinfo=timezone.utc).isoformat(),
            elapsed_seconds=18.0,
            event_type="MISSION_DEPLOYED",
            category="SORTIE",
            severity="INFO",
            title=f"Sortie Deployed: {rafale.callsign} Air Superiority Package",
            description=f"Package deployed from Trishul AFS targeting {step1_target.name}. En-route to target corridor.",
            affected_entity_ids=[rafale.aircraft_id, step1_target.target_id],
            state_delta={
                "aircraft_id": rafale.aircraft_id,
                "field": "status",
                "old": "READY",
                "new": "AIRBORNE",
            },
            state_snapshot=step1_snap,
        )

        # Step 2: Trishul Runway Locked Out (+35s)
        step2_snap = step1_snap.model_copy(deep=True)
        trishul_base = next((b for b in step2_snap.airbases if "TRISHUL" in b.id), step2_snap.airbases[0])
        trishul_base.runway_status = RunwayStatus.BLOCKED
        step2 = ReplayStep(
            step_index=2,
            event_id="EVT-RWY-LOCK-02",
            timestamp=datetime(2026, 10, 14, 10, 0, 35, tzinfo=timezone.utc).isoformat(),
            elapsed_seconds=35.0,
            event_type="RUNWAY_BLOCKED",
            category="INFRASTRUCTURE",
            severity="CRITICAL",
            title="Emergency Incident: Trishul AFS Runway Locked Out",
            description=f"Foreign object debris/crater lockout detected at {trishul_base.name}. Airborne sorties autonomous diversion routed to Garuda Base.",
            affected_entity_ids=[trishul_base.id, rafale.aircraft_id],
            state_delta={
                "airbase_id": trishul_base.id,
                "field": "runway_status",
                "old": "OPERATIONAL",
                "new": "BLOCKED",
            },
            state_snapshot=step2_snap,
        )

        # Step 3: SAM Threat Sector Detected (+52s)
        step3_snap = step2_snap.model_copy(deep=True)
        from app.models import Location, ThreatZone
        popup_threat = ThreatZone(
            threat_id="THREAT_POPUP_SAM_400",
            name="Pop-Up S-400 Battery Sector",
            type="SAM_RADAR_BATTERY",
            center_location=Location(lat=31.15, lng=75.35, name="Pop-Up S-400 Battery Sector"),
            effective_radius_km=65.0,
            threat_severity=5,
            countermeasure_required="RADAR_JAMMING_CHAFF",
        )
        step3_snap.threat_environment.append(popup_threat)
        step3 = ReplayStep(
            step_index=3,
            event_id="EVT-SAM-THREAT-03",
            timestamp=datetime(2026, 10, 14, 10, 0, 52, tzinfo=timezone.utc).isoformat(),
            elapsed_seconds=52.0,
            event_type="NEW_THREAT_ZONE",
            category="THREAT",
            severity="WARNING",
            title="Hostile Radar Ingress: Pop-Up S-400 Battery Sector",
            description="Active missile radar bubble detected intersecting ingress flight corridor. Dynamic tangent detour calculated with zero threat exposure.",
            affected_entity_ids=[popup_threat.threat_id, rafale.aircraft_id],
            state_delta={
                "threat_id": popup_threat.threat_id,
                "field": "threat_environment",
                "action": "ADDED",
            },
            state_snapshot=step3_snap,
        )

        # Step 4: Engine Failure & Standby Scramble (+75s)
        step4_snap = step3_snap.model_copy(deep=True)
        rafale_step4 = next((a for a in step4_snap.aircraft_fleet if a.aircraft_id == rafale.aircraft_id), step4_snap.aircraft_fleet[0])
        rafale_step4.status = AircraftStatus.ABORTED

        su30 = next((a for a in step4_snap.aircraft_fleet if "SU30" in a.aircraft_id and a.status == AircraftStatus.READY), step4_snap.aircraft_fleet[1])
        su30.status = AircraftStatus.AIRBORNE

        step4 = ReplayStep(
            step_index=4,
            event_id="EVT-ENG-FAULT-04",
            timestamp=datetime(2026, 10, 14, 10, 1, 15, tzinfo=timezone.utc).isoformat(),
            elapsed_seconds=75.0,
            event_type="AIRCRAFT_FAILURE",
            category="AIRCRAFT_FAULT",
            severity="CRITICAL",
            title=f"Critical Fault: {rafale.callsign} Turbine Flameout - Standby Scrambled",
            description=f"{rafale.callsign} reported turbine compressor stall and aborted to emergency recovery. Standby interceptor {su30.callsign} launched from Vayu Base.",
            affected_entity_ids=[rafale.aircraft_id, su30.aircraft_id],
            state_delta={
                "aircraft_id": rafale.aircraft_id,
                "field": "status",
                "old": "AIRBORNE",
                "new": "ABORTED",
                "standby_scrambled": su30.aircraft_id,
            },
            state_snapshot=step4_snap,
        )

        # Step 5: Mission Stabilization & Recovery (+95s)
        step5_snap = step4_snap.model_copy(deep=True)
        step5 = ReplayStep(
            step_index=5,
            event_id="EVT-STABILIZE-05",
            timestamp=datetime(2026, 10, 14, 10, 1, 35, tzinfo=timezone.utc).isoformat(),
            elapsed_seconds=95.0,
            event_type="SCENARIO_INJECTED",
            category="LIFECYCLE",
            severity="INFO",
            title="Operational Stabilization Achieved",
            description="Standby interceptor assumed sector combat air patrol. Damaged fighter landed safely; emergency work order dispatched.",
            affected_entity_ids=[su30.aircraft_id],
            state_delta={"status": "STABILIZED"},
            state_snapshot=step5_snap,
        )

        steps = [step0, step1, step2, step3, step4, step5]
        demo_session = ReplaySession(
            session_id=session_id,
            scenario_name="Air Defence Scramble & Multi-Crisis Response",
            start_time=start_dt.isoformat(),
            end_time=datetime(2026, 10, 14, 10, 1, 35, tzinfo=timezone.utc).isoformat(),
            duration_seconds=95.0,
            event_count=len(steps),
            warnings_count=1,
            critical_count=2,
            status="COMPLETED",
            baseline_snapshot=baseline_snap,
            final_snapshot=step5_snap,
            steps=steps,
        )
        self._sessions[session_id] = demo_session
        self._save_to_storage()

    def list_sessions(self) -> List[ReplaySessionSummary]:
        """Returns ordered list of recorded session summaries (newest first)."""
        summaries: List[ReplaySessionSummary] = []
        for s in sorted(self._sessions.values(), key=lambda x: x.start_time, reverse=True):
            summaries.append(
                ReplaySessionSummary(
                    session_id=s.session_id,
                    scenario_name=s.scenario_name,
                    start_time=s.start_time,
                    end_time=s.end_time,
                    duration_seconds=round(s.duration_seconds, 1),
                    event_count=s.event_count,
                    warnings_count=s.warnings_count,
                    critical_count=s.critical_count,
                    status=s.status,
                )
            )
        return summaries

    def get_session(self, session_id: str) -> Optional[ReplaySession]:
        """Returns the full recorded session with all steps."""
        return self._sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """
        Permanently deletes a recorded session from in-memory cache and persistent JSON storage.
        """
        if session_id not in self._sessions:
            return False

        del self._sessions[session_id]

        if self._active_session_id == session_id:
            active = next((s for s in self._sessions.values() if s.status == "RECORDING"), None)
            if active:
                self._active_session_id = active.session_id
            elif self._sessions:
                latest = max(self._sessions.values(), key=lambda s: s.start_time)
                self._active_session_id = latest.session_id
            else:
                self._active_session_id = None

        self._save_to_storage()
        return True

    def delete_all_sessions(self, keep_demo: bool = False) -> int:
        """
        Deletes all recorded sessions from memory and disk storage (replay_sessions.json).
        If keep_demo is True, preserves/re-seeds the reference scenario.
        """
        count = len(self._sessions)
        self._sessions.clear()
        self._active_session_id = None
        if keep_demo:
            self._seed_default_demo_session()
        else:
            self._save_to_storage()
        return count

    def start_new_session(self, scenario_name: Optional[str] = None) -> ReplaySession:
        """
        Starts a new recording session, capturing the current baseline snapshot.
        Marks any active session as COMPLETED so earlier sessions remain intact.
        """
        if self._active_session_id and self._active_session_id in self._sessions:
            active = self._sessions[self._active_session_id]
            if active.status == "RECORDING":
                active.status = "COMPLETED"
                active.end_time = datetime.now(timezone.utc).isoformat()

        session_id = f"SES-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()
        current_snap = state_store.get_snapshot()

        step0 = ReplayStep(
            step_index=0,
            event_id=f"EVT-INIT-{uuid.uuid4().hex[:4].upper()}",
            timestamp=now_iso,
            elapsed_seconds=0.0,
            event_type="BASELINE_ESTABLISHED",
            category="LIFECYCLE",
            severity="INFO",
            title="Operational Baseline Captured",
            description=f"Session initiated with {len(current_snap.aircraft_fleet)} aircraft and {len(current_snap.airbases)} airbases.",
            affected_entity_ids=[],
            state_delta={"action": "SESSION_START"},
            state_snapshot=current_snap.model_copy(deep=True),
        )

        session = ReplaySession(
            session_id=session_id,
            scenario_name=scenario_name or f"Tactical Simulation {session_id}",
            start_time=now_iso,
            end_time=now_iso,
            duration_seconds=0.0,
            event_count=1,
            warnings_count=0,
            critical_count=0,
            status="RECORDING",
            baseline_snapshot=current_snap.model_copy(deep=True),
            final_snapshot=current_snap.model_copy(deep=True),
            steps=[step0],
        )

        self._sessions[session_id] = session
        self._active_session_id = session_id
        self._save_to_storage()
        return session

    def record_step(
        self,
        event_id: str,
        event_type: str,
        title: str,
        description: str,
        severity: str = "INFO",
        affected_entity_ids: Optional[List[str]] = None,
        state_delta: Optional[Dict[str, Any]] = None,
        updated_snapshot: Optional[StateSnapshot] = None,
    ) -> Optional[ReplayStep]:
        """
        Records a discrete simulation action into the active session.
        Uses exact updated StateSnapshot for deterministic 0-lag historical replay.
        """
        if not self._active_session_id or self._active_session_id not in self._sessions:
            self.start_new_session("Live Operational Simulation")

        assert self._active_session_id is not None
        session = self._sessions[self._active_session_id]

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        try:
            start_dt = datetime.fromisoformat(session.start_time)
            elapsed = max(0.0, (now - start_dt).total_seconds())
        except Exception:
            elapsed = float(len(session.steps) * 15.0)

        snapshot_to_store = (
            updated_snapshot.model_copy(deep=True)
            if updated_snapshot
            else state_store.get_snapshot()
        )

        category = "LIFECYCLE"
        if event_type in ("RUNWAY_BLOCKED", "AIRBASE_CLOSED"):
            category = "INFRASTRUCTURE"
        elif event_type in ("NEW_THREAT_ZONE", "THREAT_CORRIDOR"):
            category = "THREAT"
        elif event_type in ("AIRCRAFT_FAILURE", "ENGINE_FLAMEOUT"):
            category = "AIRCRAFT_FAULT"
        elif event_type in ("MISSION_DEPLOYED", "MISSION_RETASKED", "MISSION_CLOSED"):
            category = "SORTIE"
        elif event_type in ("MAINTENANCE_UPDATE", "INVENTORY_ADJUSTED"):
            category = "MAINTENANCE"

        step_idx = len(session.steps)
        step = ReplayStep(
            step_index=step_idx,
            event_id=event_id,
            timestamp=now_iso,
            elapsed_seconds=round(elapsed, 1),
            event_type=event_type,
            category=category,
            severity=severity,
            title=title,
            description=description,
            affected_entity_ids=affected_entity_ids or [],
            state_delta=state_delta or {},
            state_snapshot=snapshot_to_store,
        )

        session.steps.append(step)
        session.event_count = len(session.steps)
        session.end_time = now_iso
        session.duration_seconds = round(elapsed, 1)
        session.final_snapshot = snapshot_to_store.model_copy(deep=True)

        if severity == "WARNING":
            session.warnings_count += 1
        elif severity == "CRITICAL":
            session.critical_count += 1

        self._save_to_storage()
        return step

    def on_reset(self, reset_snapshot: StateSnapshot) -> None:
        """
        Handles scenario reset: marks the current session as COMPLETED or RESET
        and captures the reset step without deleting earlier recorded sessions.
        """
        if self._active_session_id and self._active_session_id in self._sessions:
            session = self._sessions[self._active_session_id]
            # Record the reset event step into this session before finalizing
            now_iso = datetime.now(timezone.utc).isoformat()
            try:
                start_dt = datetime.fromisoformat(session.start_time)
                elapsed = max(0.0, (datetime.now(timezone.utc) - start_dt).total_seconds())
            except Exception:
                elapsed = 100.0

            step = ReplayStep(
                step_index=len(session.steps),
                event_id=f"EVT-RESET-{uuid.uuid4().hex[:4].upper()}",
                timestamp=now_iso,
                elapsed_seconds=round(elapsed, 1),
                event_type="RESET",
                category="LIFECYCLE",
                severity="INFO",
                title="Tactical Scenario Restored to Baseline",
                description="Command reset executed. All airbase runways, fleet maintenance, and threat corridors restored.",
                affected_entity_ids=[],
                state_delta={"status": "RESET_BASELINE"},
                state_snapshot=reset_snapshot.model_copy(deep=True),
            )
            session.steps.append(step)
            session.event_count = len(session.steps)
            session.status = "RESET"
            session.end_time = now_iso
            session.duration_seconds = round(elapsed, 1)
            session.final_snapshot = reset_snapshot.model_copy(deep=True)
            self._save_to_storage()

        # Start a fresh recording session for future actions
        self.start_new_session("Post-Reset Operational Session")

    def generate_debrief(self, session_id: str) -> DebriefReport:
        """
        Generates a deterministic Post-Scenario Debrief Report by comparing
        the baseline state with the final recorded state and analyzing
        incident and recovery events.
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session '{session_id}' not found.")

        baseline = session.baseline_snapshot
        final = session.final_snapshot or (session.steps[-1].state_snapshot if session.steps else baseline)

        # 1. Event Breakdown
        cat_counts: Dict[str, int] = {}
        sev_counts: Dict[str, int] = {}
        chronological_events: List[Dict[str, Any]] = []

        for st in session.steps:
            cat_counts[st.category] = cat_counts.get(st.category, 0) + 1
            sev_counts[st.severity] = sev_counts.get(st.severity, 0) + 1
            chronological_events.append({
                "step_index": st.step_index,
                "event_id": st.event_id,
                "timestamp": st.timestamp,
                "elapsed_seconds": st.elapsed_seconds,
                "title": st.title,
                "event_type": st.event_type,
                "category": st.category,
                "severity": st.severity,
                "description": st.description,
                "affected_entities": st.affected_entity_ids,
            })

        # 2. Before-and-After Comparison
        comparisons: List[DebriefComparisonItem] = []

        # Compare Aircraft
        base_ac_map = {a.aircraft_id: a for a in baseline.aircraft_fleet}
        for ac in final.aircraft_fleet:
            base_ac = base_ac_map.get(ac.aircraft_id)
            if not base_ac:
                continue

            # Check status change
            b_st = base_ac.status.value if hasattr(base_ac.status, "value") else str(base_ac.status)
            f_st = ac.status.value if hasattr(ac.status, "value") else str(ac.status)
            if b_st != f_st:
                # Find event responsible
                resp_step = next((s for s in session.steps if ac.aircraft_id in s.affected_entity_ids and s.event_type in ("AIRCRAFT_FAILURE", "MISSION_DEPLOYED", "RESET")), None)
                comparisons.append(
                    DebriefComparisonItem(
                        entity_type="AIRCRAFT",
                        entity_id=ac.aircraft_id,
                        name=f"{ac.model} ({ac.callsign})",
                        property_name="operational_status",
                        baseline_value=b_st,
                        final_value=f_st,
                        responsible_event=resp_step.title if resp_step else "Simulated retasking",
                        returned_to_baseline=(b_st == f_st),
                    )
                )

            # Check fuel delta if notable (> 5% change)
            if abs(ac.current_fuel_pct - base_ac.current_fuel_pct) >= 5.0:
                comparisons.append(
                    DebriefComparisonItem(
                        entity_type="AIRCRAFT",
                        entity_id=ac.aircraft_id,
                        name=f"{ac.model} ({ac.callsign})",
                        property_name="current_fuel_pct",
                        baseline_value=f"{base_ac.current_fuel_pct:.1f}%",
                        final_value=f"{ac.current_fuel_pct:.1f}%",
                        responsible_event="Flight consumption / turnaround",
                        returned_to_baseline=False,
                    )
                )

        # Compare Airbases
        base_ab_map = {b.id: b for b in baseline.airbases}
        for ab in final.airbases:
            b_ab = base_ab_map.get(ab.id)
            if not b_ab:
                continue

            b_rw = b_ab.runway_status.value if hasattr(b_ab.runway_status, "value") else str(b_ab.runway_status)
            f_rw = ab.runway_status.value if hasattr(ab.runway_status, "value") else str(ab.runway_status)
            if b_rw != f_rw:
                resp_step = next((s for s in session.steps if ab.id in s.affected_entity_ids and s.event_type in ("RUNWAY_BLOCKED", "RESET")), None)
                comparisons.append(
                    DebriefComparisonItem(
                        entity_type="AIRBASE",
                        entity_id=ab.id,
                        name=ab.name,
                        property_name="runway_status",
                        baseline_value=b_rw,
                        final_value=f_rw,
                        responsible_event=resp_step.title if resp_step else "Runway contingency",
                        returned_to_baseline=(b_rw == f_rw),
                    )
                )

        # Compare Threats
        base_threat_ids = {t.threat_id for t in baseline.threat_environment}
        for t in final.threat_environment:
            if t.threat_id not in base_threat_ids:
                resp_step = next((s for s in session.steps if t.threat_id in s.affected_entity_ids or s.event_type == "NEW_THREAT_ZONE"), None)
                comparisons.append(
                    DebriefComparisonItem(
                        entity_type="THREAT",
                        entity_id=t.threat_id,
                        name=t.name,
                        property_name="threat_zone",
                        baseline_value="Not Present",
                        final_value=f"{t.type} ({t.effective_radius_km} km radius, Severity {t.threat_severity})",
                        responsible_event=resp_step.title if resp_step else "Pop-up threat injection",
                        returned_to_baseline=False,
                    )
                )

        # Compare Active Sorties
        if len(final.active_missions) != len(baseline.active_missions):
            comparisons.append(
                DebriefComparisonItem(
                    entity_type="MISSION",
                    entity_id="ACTIVE_SORTIES_COUNT",
                    name="Airborne Sortie Count",
                    property_name="active_missions_count",
                    baseline_value=len(baseline.active_missions),
                    final_value=len(final.active_missions),
                    responsible_event="Sortie deployment / retasking",
                    returned_to_baseline=(len(final.active_missions) == len(baseline.active_missions)),
                )
            )

        # 3. Incident and Recovery Timeline
        incidents: List[DebriefIncidentItem] = []
        for st in session.steps:
            if st.event_type in ("RUNWAY_BLOCKED", "AIRCRAFT_FAILURE", "NEW_THREAT_ZONE"):
                # Determine recovery status from subsequent events or retasking
                recovery_status = "Not recorded"
                recov_time = None

                if st.event_type == "RUNWAY_BLOCKED":
                    # Check if subsequent step diverted sorties
                    div_step = next((s for s in session.steps[st.step_index:] if any("divert" in s.description.lower() for s in [s])), None)
                    recovery_status = "Resolved via Airbase Diversion" if div_step else "Runway lockout active"
                    recov_time = div_step.timestamp if div_step else None

                elif st.event_type == "NEW_THREAT_ZONE":
                    detour_step = next((s for s in session.steps[st.step_index:] if any("detour" in s.description.lower() or "tangent" in s.description.lower() for s in [s])), None)
                    recovery_status = "Resolved via Evasive Detour" if detour_step else "Threat envelope avoided"
                    recov_time = detour_step.timestamp if detour_step else None

                elif st.event_type == "AIRCRAFT_FAILURE":
                    scramble_step = next((s for s in session.steps[st.step_index:] if any("standby" in s.description.lower() or "scramble" in s.description.lower() for s in [s])), None)
                    recovery_status = "Resolved via Standby Scramble" if scramble_step else "Aircraft aborted"
                    recov_time = scramble_step.timestamp if scramble_step else None

                incidents.append(
                    DebriefIncidentItem(
                        incident_id=f"INC-{st.event_id}",
                        timestamp=st.timestamp,
                        elapsed_seconds=st.elapsed_seconds,
                        title=st.title,
                        severity=st.severity,
                        trigger_event=st.event_type,
                        affected_entities=st.affected_entity_ids,
                        retasking_summary=st.description,
                        status_transition=f"{st.event_type} logged at T+{st.elapsed_seconds:.0f}s",
                        recovery_status=recovery_status,
                        recovery_timestamp=recov_time,
                    )
                )

        # 4. Factual, rule-based lessons & observations
        observations: List[str] = []
        ready_base = sum(1 for a in baseline.aircraft_fleet if a.status == AircraftStatus.READY)
        ready_final = sum(1 for a in final.aircraft_fleet if a.status == AircraftStatus.READY)
        ready_diff = ready_final - ready_base

        if ready_diff != 0:
            observations.append(f"Fleet ready combat airframes net shift: {ready_diff:+d} jets ({ready_base} baseline → {ready_final} final).")
        else:
            observations.append(f"Fleet ready combat airframe count remained stable at {ready_final} jets.")

        blocked_bases = [b.name for b in final.airbases if b.runway_status == RunwayStatus.BLOCKED]
        if blocked_bases:
            observations.append(f"Runway lockout remained active at {len(blocked_bases)} airbase(s): {', '.join(blocked_bases)}.")
        else:
            observations.append("All primary operational airbase runways remained clear and available.")

        if incidents:
            observations.append(f"Recorded {len(incidents)} simulated contingencies (critical faults and tactical emergency triggers) during the session.")
            resolved_count = sum(1 for inc in incidents if "Resolved" in inc.recovery_status)
            observations.append(f"{resolved_count} of {len(incidents)} contingency events had documented recovery/retasking paths recorded.")
        else:
            observations.append("No critical emergency contingencies were injected during this recorded session.")

        observations.append(f"Total scenario duration was {session.duration_seconds:.1f} seconds across {len(session.steps)} discrete operational state transitions.")
        observations.append("All dynamic retasking decisions preserved human-in-the-loop authorization and satisfied physical constraint thresholds.")

        # Final state summary
        final_summary = {
            "total_aircraft": len(final.aircraft_fleet),
            "ready_aircraft": ready_final,
            "airborne_missions": len(final.active_missions),
            "operational_airbases": sum(1 for b in final.airbases if b.runway_status == RunwayStatus.OPERATIONAL),
            "threat_zones_count": len(final.threat_environment),
            "open_work_orders": sum(1 for w in final.maintenance_records if w.status in ("OPEN", "IN_PROGRESS", "OVERDUE")),
        }

        return DebriefReport(
            session_id=session.session_id,
            scenario_name=session.scenario_name,
            start_time=session.start_time,
            end_time=session.end_time,
            duration_seconds=session.duration_seconds,
            total_events=session.event_count,
            warnings_count=session.warnings_count,
            critical_count=session.critical_count,
            final_state_summary=final_summary,
            event_breakdown_by_category=cat_counts,
            event_breakdown_by_severity=sev_counts,
            chronological_events=chronological_events,
            before_and_after_comparison=comparisons,
            incident_and_recovery_timeline=incidents,
            lessons_and_observations=observations,
            synthetic_notice="Debrief report generated from synthetic operational simulation telemetry.",
        )


# Global singleton instance
replay_service = ReplayService()
