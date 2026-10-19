"""
Tests for Dynamic Events, Retasking Engine, and WebSockets.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    AircraftStatus,
    EventType,
    MissionStatus,
    RunwayStatus,
    ThreatType,
)
from app.state import state_store


@pytest.fixture(autouse=True)
def reset_state():
    """Ensure clean initial state before each event test."""
    state_store.reset_to_initial()


@pytest.fixture
def client():
    return TestClient(app)


def test_event_runway_blocked_diversion(client):
    """
    Test Event 1: RUNWAY_BLOCKED
    Deploys a mission, locks out its departure/recovery base, and verifies
    automatic diversion to nearest viable alternate operational airbase.
    """
    # 1. Plan & Deploy Mission to Alpha Bunker
    plan_res = client.post("/api/missions/plan", json={"target_id": "TGT_ALPHA_BUNKER", "priority_level": 5})
    assert plan_res.status_code == 200
    pkg = plan_res.json()["packages"][0]
    pkg_id = pkg["package_id"]
    home_base_id = pkg["airbase"]["id"]
    home_base_name = pkg["airbase"]["name"]

    deploy_res = client.post(f"/api/missions/{pkg_id}/deploy")
    assert deploy_res.status_code == 200
    active_msn = deploy_res.json()
    msn_id = active_msn["mission_id"]

    # 2. Trigger RUNWAY_BLOCKED on departure base
    event_res = client.post("/api/events/trigger", json={
        "event_type": EventType.RUNWAY_BLOCKED.value,
        "payload": {"airbase_id": home_base_id},
    })
    assert event_res.status_code == 200
    evt_data = event_res.json()

    assert evt_data["status"] == "PROCESSED"
    assert len(evt_data["retasking_log"]) >= 1

    retask = evt_data["retasking_log"][0]
    assert retask["action_type"] == "DIVERTED"
    assert retask["mission_id"] == msn_id
    assert retask["new_recovery_base_id"] is not None
    assert retask["new_recovery_base_id"] != home_base_id

    # 3. Verify State Update
    state_after = client.get("/api/state").json()
    base_after = next(b for b in state_after["airbases"] if b["id"] == home_base_id)
    assert base_after["runway_status"] == RunwayStatus.BLOCKED.value

    msn_after = next(m for m in state_after["active_missions"] if m["mission_id"] == msn_id)
    assert msn_after["status"] == MissionStatus.REROUTED.value
    assert msn_after["route"]["rerouted"] is True
    # Last waypoint must now be the new alternate recovery base
    assert msn_after["route"]["waypoints"][-1]["action"] == "RECOVERY"


def test_event_new_threat_zone_rerouting(client):
    """
    Test Event 2: NEW_THREAT_ZONE
    Deploys a mission and spawns a high-threat SAM battery right on its corridor.
    Verifies Shapely intersection detection, tangent detour insertion, and ETD delta.
    """
    # 1. Plan & Deploy
    plan_res = client.post("/api/missions/plan", json={"target_id": "TGT_ALPHA_BUNKER"})
    pkg = plan_res.json()["packages"][0]
    deploy_res = client.post(f"/api/missions/{pkg['package_id']}/deploy")
    active_msn = deploy_res.json()
    msn_id = active_msn["mission_id"]
    old_eta = active_msn["route"]["eta_mins"]

    # Ingress is between Trishul (~30.36, 76.81) and Alpha Bunker (31.80, 74.20)
    # Midpoint is ~31.08, 75.50
    threat_lat = 31.08
    threat_lng = 75.50

    # 2. Trigger NEW_THREAT_ZONE
    event_res = client.post("/api/events/trigger", json={
        "event_type": EventType.NEW_THREAT_ZONE.value,
        "payload": {
            "threat_id": "THREAT_SAM_POPUP_TEST",
            "name": "Pop-Up S-300 Battery Test",
            "type": ThreatType.SAM_RADAR_BATTERY.value,
            "lat": threat_lat,
            "lng": threat_lng,
            "radius_km": 60.0,
            "severity": 5,
        },
    })
    assert event_res.status_code == 200
    evt_data = event_res.json()

    assert evt_data["status"] == "PROCESSED"
    assert len(evt_data["retasking_log"]) >= 1

    retask = evt_data["retasking_log"][0]
    assert retask["action_type"] == "REROUTED"
    assert retask["mission_id"] == msn_id
    assert retask["added_time_mins"] is not None

    # 3. Verify State Update
    state_after = client.get("/api/state").json()
    msn_after = next(m for m in state_after["active_missions"] if m["mission_id"] == msn_id)
    assert msn_after["status"] == MissionStatus.REROUTED.value
    # Detour node inserted
    has_detour = any(w["action"] == "DETOUR" for w in msn_after["route"]["waypoints"])
    assert has_detour, "Route must contain DETOUR waypoint"
    assert msn_after["route"]["eta_mins"] >= old_eta


def test_event_aircraft_failure_and_replacement(client):
    """
    Test Event 3: AIRCRAFT_FAILURE
    Deploys a mission, triggers an engine fault on the aircraft, and verifies
    mission abort and optimizer invocation for standby replacement jet.
    """
    # 1. Plan & Deploy
    plan_res = client.post("/api/missions/plan", json={"target_id": "TGT_ALPHA_BUNKER"})
    pkg = plan_res.json()["packages"][0]
    ac_id = pkg["aircraft"]["aircraft_id"]

    deploy_res = client.post(f"/api/missions/{pkg['package_id']}/deploy")
    active_msn = deploy_res.json()
    msn_id = active_msn["mission_id"]

    # 2. Trigger AIRCRAFT_FAILURE
    event_res = client.post("/api/events/trigger", json={
        "event_type": EventType.AIRCRAFT_FAILURE.value,
        "payload": {"aircraft_id": ac_id},
    })
    assert event_res.status_code == 200
    evt_data = event_res.json()

    assert evt_data["status"] == "PROCESSED"
    assert len(evt_data["retasking_log"]) >= 1
    retask = evt_data["retasking_log"][0]
    assert retask["action_type"] in ("REPLACED", "ABORTED")

    # 3. Verify Failed Aircraft Status and Replacement Mission in State
    state_after = client.get("/api/state").json()
    failed_ac = next(a for a in state_after["aircraft_fleet"] if a["aircraft_id"] == ac_id)
    assert failed_ac["status"] == AircraftStatus.ABORTED.value

    # If replaced, active_missions contains the new replacement mission
    if retask["action_type"] == "REPLACED":
        replacement_ac_id = retask["aircraft_id"]
        replacement_ac = next(a for a in state_after["aircraft_fleet"] if a["aircraft_id"] == replacement_ac_id)
        assert replacement_ac["status"] == AircraftStatus.AIRBORNE.value
        assert any(m["mission_id"] == retask["mission_id"] for m in state_after["active_missions"])


def test_event_reset_scenario(client):
    """Test POST /api/events/reset cleanly restores baseline scenario."""
    # Deploy a mission and trigger a runway blockage
    plan_res = client.post("/api/missions/plan", json={"target_id": "TGT_ALPHA_BUNKER"})
    client.post(f"/api/missions/{plan_res.json()['packages'][0]['package_id']}/deploy")
    client.post("/api/events/trigger", json={
        "event_type": EventType.RUNWAY_BLOCKED.value,
        "payload": {"airbase_id": "BASE_TRISHUL"},
    })

    # Reset
    reset_res = client.post("/api/events/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "RESET_SUCCESS"

    # Verify baseline restored
    state_after = client.get("/api/state").json()
    assert len(state_after["active_missions"]) == 0
    trishul = next(b for b in state_after["airbases"] if b["id"] == "BASE_TRISHUL")
    assert trishul["runway_status"] == RunwayStatus.OPERATIONAL.value


def test_websocket_connection_and_heartbeat(client):
    """Test WebSocket initial snapshot and ping-pong."""
    with client.websocket_connect("/ws") as ws:
        # First message must be STATE_SNAPSHOT
        data = ws.receive_json()
        assert data["type"] == "STATE_SNAPSHOT"
        assert "aircraft_fleet" in data["data"]
        assert len(data["data"]["aircraft_fleet"]) >= 12

        # Send ping
        ws.send_text("ping")
        reply = ws.receive_text()
        assert reply == "pong"
