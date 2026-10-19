"""
Unit and Integration Tests for Optimizer Engine and Hard Constraint Verification.
Tests each of the 8 hard constraints with failing scenarios and verifies Top-3 distinctness.
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    AircraftStatus,
    Location,
    MissionTarget,
    PilotQualification,
    PlanMissionRequest,
    RunwayStatus,
    StateSnapshot,
    TargetType,
    WeaponCategory,
)
from app.optimizer import plan_mission, evaluate_candidate
from app.state import state_store
from app.geo import (
    compute_route_threat_exposure,
    compute_route_total_distance_km,
    generate_detour_waypoints,
    haversine_distance_km,
)


@pytest.fixture(autouse=True)
def reset_state():
    """Ensure clean state before each test."""
    state_store.reset_to_initial()


@pytest.fixture
def client():
    return TestClient(app)


# =============================================================
# 1. GEOMETRY & THREAT INTERSECTION TESTS
# =============================================================

def test_haversine_distance():
    # Distance between New Delhi (~28.61, 77.20) and Ambala (~30.36, 76.81) is ~200 km
    d = haversine_distance_km(28.61, 77.20, 30.36, 76.81)
    assert 180 <= d <= 220


def test_threat_exposure_and_detour():
    snapshot = state_store.get_snapshot()
    start = Location(lat=snapshot.airbases[0].lat, lng=snapshot.airbases[0].lng, name=snapshot.airbases[0].name)
    end = snapshot.mission_targets[0].location

    score, breakdown = compute_route_threat_exposure(start, end, snapshot.threat_environment)
    assert isinstance(score, float)
    assert score >= 0.0

    waypoints = generate_detour_waypoints(start, end, snapshot.threat_environment)
    assert len(waypoints) >= 3
    assert waypoints[0].action == "TAKEOFF"
    assert waypoints[-1].action == "RECOVERY"
    total_dist = compute_route_total_distance_km(waypoints)
    assert total_dist > 0


# =============================================================
# 2. HARD CONSTRAINT ISOLATION TESTS (1 Failing Case Per Constraint)
# =============================================================

def test_constraint_c1_runway_blocked_fails():
    """C1: Blocked runway must cause all aircraft at that base to fail."""
    snapshot = state_store.get_snapshot()
    # Mark Trishul AFS as BLOCKED
    trishul = next(b for b in snapshot.airbases if b.id == "BASE_TRISHUL")
    trishul.runway_status = RunwayStatus.BLOCKED

    target = snapshot.mission_targets[0]  # Alpha bunker
    res = plan_mission(target, snapshot, top_k=5)

    # Ensure no package uses an aircraft from Trishul
    for pkg in res.packages:
        assert pkg.aircraft.home_base_id != "BASE_TRISHUL", "Aircraft from BLOCKED base must not be selected"


def test_constraint_c2_aircraft_status_maintenance_fails():
    """C2: Aircraft in MAINTENANCE must fail C2 constraint check."""
    snapshot = state_store.get_snapshot()
    maint_ac = next(a for a in snapshot.aircraft_fleet if a.status == AircraftStatus.MAINTENANCE)
    base = next(b for b in snapshot.airbases if b.id == maint_ac.home_base_id)
    pilot = next(p for p in snapshot.pilots if p.home_base_id == base.id)
    target = snapshot.mission_targets[0]

    cand = evaluate_candidate(
        aircraft=maint_ac,
        pilot=pilot,
        airbase=base,
        target=target,
        weapons_map={w.weapon_id: w for w in snapshot.weapons_inventory},
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c2_chk = next(c for c in cand.constraint_checks if c.constraint == "C2_AIRCRAFT_STATUS_READY")
    assert not c2_chk.passed
    assert not cand.is_feasible


def test_constraint_c3_pilot_at_wrong_base_fails():
    """C3: Pilot stationed at a different base must fail C3."""
    snapshot = state_store.get_snapshot()
    ac = snapshot.aircraft_fleet[0]  # Base Trishul
    base = next(b for b in snapshot.airbases if b.id == ac.home_base_id)
    wrong_pilot = next(p for p in snapshot.pilots if p.home_base_id != base.id)
    target = snapshot.mission_targets[0]

    cand = evaluate_candidate(
        aircraft=ac,
        pilot=wrong_pilot,
        airbase=base,
        target=target,
        weapons_map={w.weapon_id: w for w in snapshot.weapons_inventory},
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c3_chk = next(c for c in cand.constraint_checks if c.constraint == "C3_PILOT_STATIONED_AND_AVAILABLE")
    assert not c3_chk.passed
    assert not cand.is_feasible


def test_constraint_c4_pilot_rest_under_8h_fails():
    """C4: Pilot with < 8.0h rest must fail C4."""
    snapshot = state_store.get_snapshot()
    fatigued_pilot = next(p for p in snapshot.pilots if p.rest_hours_completed < 8.0)
    base = next(b for b in snapshot.airbases if b.id == fatigued_pilot.home_base_id)
    ac = next(a for a in snapshot.aircraft_fleet if a.home_base_id == base.id)
    target = snapshot.mission_targets[0]

    cand = evaluate_candidate(
        aircraft=ac,
        pilot=fatigued_pilot,
        airbase=base,
        target=target,
        weapons_map={w.weapon_id: w for w in snapshot.weapons_inventory},
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c4_chk = next(c for c in cand.constraint_checks if c.constraint == "C4_PILOT_MANDATORY_REST")
    assert not c4_chk.passed
    assert not cand.is_feasible


def test_constraint_c5_missing_pilot_qualifications_fails():
    """C5: Pilot lacking required qualifications (e.g. DEAD_SEAD) must fail C5."""
    snapshot = state_store.get_snapshot()
    # Radar station target requires DEAD_SEAD_CERTIFIED
    radar_tgt = next(t for t in snapshot.mission_targets if t.target_type == TargetType.RADAR_STATION)
    unqualified_pilot = next(
        p for p in snapshot.pilots if PilotQualification.DEAD_SEAD_CERTIFIED not in p.qualifications
    )
    base = next(b for b in snapshot.airbases if b.id == unqualified_pilot.home_base_id)
    ac = next(a for a in snapshot.aircraft_fleet if a.home_base_id == base.id)

    cand = evaluate_candidate(
        aircraft=ac,
        pilot=unqualified_pilot,
        airbase=base,
        target=radar_tgt,
        weapons_map={w.weapon_id: w for w in snapshot.weapons_inventory},
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c5_chk = next(c for c in cand.constraint_checks if c.constraint == "C5_PILOT_QUALIFICATIONS")
    assert not c5_chk.passed
    assert not cand.is_feasible


def test_constraint_c6_ordnance_mismatch_fails():
    """C6: Aircraft with no compatible weapon category must fail C6."""
    snapshot = state_store.get_snapshot()
    # Echo frigate requires ANTI_SHIP weapon
    naval_tgt = next(t for t in snapshot.mission_targets if t.target_type == TargetType.NAVAL_VESSEL)
    weapon_map = {w.weapon_id: w for w in snapshot.weapons_inventory}

    # Rafale 01 has only HAMMER and AAMs, no ANTI_SHIP
    ac = next(a for a in snapshot.aircraft_fleet if a.aircraft_id == "AC_RAFALE_01")
    base = next(b for b in snapshot.airbases if b.id == ac.home_base_id)
    pilot = next(p for p in snapshot.pilots if p.home_base_id == base.id)

    cand = evaluate_candidate(
        aircraft=ac,
        pilot=pilot,
        airbase=base,
        target=naval_tgt,
        weapons_map=weapon_map,
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c6_chk = next(c for c in cand.constraint_checks if c.constraint == "C6_ORDNANCE_COMPATIBILITY_AND_STOCK")
    assert not c6_chk.passed
    assert not cand.is_feasible


def test_constraint_c7_mtow_limit_fails():
    """C7: Exceeding MTOW must fail C7."""
    snapshot = state_store.get_snapshot()
    ac = snapshot.aircraft_fleet[0].model_copy(deep=True)
    # Artificially lower MTOW below empty weight
    ac.max_takeoff_weight_kg = ac.empty_weight_kg - 500.0

    base = next(b for b in snapshot.airbases if b.id == ac.home_base_id)
    pilot = next(p for p in snapshot.pilots if p.home_base_id == base.id)
    target = snapshot.mission_targets[0]

    cand = evaluate_candidate(
        aircraft=ac,
        pilot=pilot,
        airbase=base,
        target=target,
        weapons_map={w.weapon_id: w for w in snapshot.weapons_inventory},
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c7_chk = next(c for c in cand.constraint_checks if c.constraint == "C7_MAX_TAKEOFF_WEIGHT_LIMIT")
    assert not c7_chk.passed
    assert not cand.is_feasible


def test_constraint_c8_insufficient_range_fails():
    """C8: Insufficient fuel range for round trip + 40% margin must fail C8."""
    snapshot = state_store.get_snapshot()
    ac = snapshot.aircraft_fleet[0].model_copy(deep=True)
    # Set fuel to 5%
    ac.current_fuel_pct = 5.0

    base = next(b for b in snapshot.airbases if b.id == ac.home_base_id)
    pilot = next(p for p in snapshot.pilots if p.home_base_id == base.id)
    target = snapshot.mission_targets[0]

    cand = evaluate_candidate(
        aircraft=ac,
        pilot=pilot,
        airbase=base,
        target=target,
        weapons_map={w.weapon_id: w for w in snapshot.weapons_inventory},
        active_mission_aircraft_ids=set(),
        active_mission_pilot_ids=set(),
        threats=snapshot.threat_environment,
    )
    c8_chk = next(c for c in cand.constraint_checks if c.constraint == "C8_COMBAT_FUEL_RANGE")
    assert not c8_chk.passed
    assert not cand.is_feasible


# =============================================================
# 3. TOP-3 DISTINCTNESS & API INTEGRATION TESTS
# =============================================================

def test_top_3_distinct_aircraft(client):
    """Verify that /api/missions/plan returns distinct aircraft for Top 3 packages."""
    target_id = "TGT_ALPHA_BUNKER"
    response = client.post("/api/missions/plan", json={"target_id": target_id, "priority_level": 5})
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "FEASIBLE"
    packages = data["packages"]
    assert len(packages) >= 2

    # Check distinct aircraft IDs
    ac_ids = [p["aircraft"]["aircraft_id"] for p in packages]
    assert len(ac_ids) == len(set(ac_ids)), "Top packages must have distinct aircraft"

    # Check ranks 1, 2, 3
    for idx, pkg in enumerate(packages):
        assert pkg["rank"] == idx + 1
        assert len(pkg["constraint_report"]) == 8
        assert all(c["passed"] for c in pkg["constraint_report"])


def test_deploy_mission_flow(client):
    """Test full plan -> deploy -> verify active mission & stock decrement."""
    # 1. Plan
    plan_res = client.post("/api/missions/plan", json={"target_id": "TGT_ALPHA_BUNKER"})
    assert plan_res.status_code == 200
    pkg = plan_res.json()["packages"][0]
    pkg_id = pkg["package_id"]
    ac_id = pkg["aircraft"]["aircraft_id"]
    pilot_id = pkg["pilot"]["pilot_id"]

    # Initial weapon stock check
    init_state = client.get("/api/state").json()
    first_wep_id = pkg["ordnance_payload"][0]["weapon_id"]
    wep_before = next(w for w in init_state["weapons_inventory"] if w["weapon_id"] == first_wep_id)
    initial_stock = wep_before["stock_count"]

    # 2. Deploy
    deploy_res = client.post(f"/api/missions/{pkg_id}/deploy")
    assert deploy_res.status_code == 200
    active_msn = deploy_res.json()
    assert active_msn["status"] == "ACTIVE"
    assert active_msn["aircraft"]["aircraft_id"] == ac_id
    assert active_msn["pilot"]["pilot_id"] == pilot_id

    # 3. Verify State Mutated
    after_state = client.get("/api/state").json()
    ac_after = next(a for a in after_state["aircraft_fleet"] if a["aircraft_id"] == ac_id)
    assert ac_after["status"] == "AIRBORNE"

    pilot_after = next(p for p in after_state["pilots"] if p["pilot_id"] == pilot_id)
    assert pilot_after["assigned_aircraft_id"] == ac_id

    wep_after = next(w for w in after_state["weapons_inventory"] if w["weapon_id"] == first_wep_id)
    assert wep_after["stock_count"] < initial_stock

    # Verify active missions endpoint
    msn_list_res = client.get("/api/missions")
    assert msn_list_res.status_code == 200
    assert len(msn_list_res.json()) >= 1
