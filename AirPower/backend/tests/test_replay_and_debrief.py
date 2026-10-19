"""
Unit and Integration Tests for Event Replay & Debrief (AirPower).
Verifies session persistence, deterministic step timeline retrieval,
isolated historical state inspection, before/after debrief comparisons,
incident and recovery timelines, and non-destructive reset handling.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import EventType
from app.replay_service import replay_service
from app.state import state_store


@pytest.fixture
def client():
    return TestClient(app)


def test_list_replay_sessions(client):
    """Verify listing recorded simulation sessions includes seed or active sessions."""
    res = client.get("/api/replay/sessions")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Check default pre-seeded session
    seed = next((s for s in data if s["session_id"] == "SES-AIRPOWER-ALPHA-DEMO"), None)
    assert seed is not None
    assert seed["scenario_name"] == "Air Defence Scramble & Multi-Crisis Response"
    assert seed["event_count"] >= 5
    assert seed["critical_count"] >= 1


def test_get_replay_session_timeline_steps(client):
    """Verify retrieving full session returns ordered steps with state snapshots."""
    res = client.get("/api/replay/sessions/SES-AIRPOWER-ALPHA-DEMO")
    assert res.status_code == 200
    session = res.json()
    assert session["session_id"] == "SES-AIRPOWER-ALPHA-DEMO"
    assert "steps" in session
    assert len(session["steps"]) >= 5

    # Check step structure
    step0 = session["steps"][0]
    assert step0["step_index"] == 0
    assert step0["elapsed_seconds"] == 0.0
    assert "state_snapshot" in step0
    assert len(step0["state_snapshot"]["aircraft_fleet"]) > 0

    # Verify elapsed time is non-decreasing (deterministic chronological order)
    times = [s["elapsed_seconds"] for s in session["steps"]]
    assert times == sorted(times)


def test_generate_debrief_report(client):
    """Verify generation of comprehensive post-scenario debrief report."""
    res = client.get("/api/replay/sessions/SES-AIRPOWER-ALPHA-DEMO/debrief")
    assert res.status_code == 200
    debrief = res.json()

    assert debrief["session_id"] == "SES-AIRPOWER-ALPHA-DEMO"
    assert debrief["total_events"] >= 5
    assert "final_state_summary" in debrief
    assert "before_and_after_comparison" in debrief
    assert "incident_and_recovery_timeline" in debrief
    assert "lessons_and_observations" in debrief

    # Before-and-After comparison must contain only changed entities
    comparisons = debrief["before_and_after_comparison"]
    assert len(comparisons) > 0
    # Trishul base runway status changed from OPERATIONAL to BLOCKED
    rwy_comp = next((c for c in comparisons if c["entity_type"] == "AIRBASE"), None)
    assert rwy_comp is not None
    assert rwy_comp["property_name"] == "runway_status"
    assert rwy_comp["baseline_value"] == "OPERATIONAL"
    assert rwy_comp["final_value"] == "BLOCKED"

    # Incident and recovery timeline
    incidents = debrief["incident_and_recovery_timeline"]
    assert len(incidents) >= 2
    rwy_inc = next((i for i in incidents if i["trigger_event"] == "RUNWAY_BLOCKED"), None)
    assert rwy_inc is not None
    assert rwy_inc["severity"] == "CRITICAL"
    assert "Airbase Diversion" in rwy_inc["recovery_status"] or "lockout" in rwy_inc["recovery_status"].lower()

    # Lessons and observations
    assert len(debrief["lessons_and_observations"]) >= 3


def test_start_new_session_and_record_events(client):
    """Verify that starting a new session and triggering simulation events records them cleanly."""
    create_res = client.post("/api/replay/sessions", json={"scenario_name": "Test Integration Scenario"})
    assert create_res.status_code == 201
    new_session = create_res.json()
    new_id = new_session["session_id"]
    assert new_session["status"] == "RECORDING"

    # Trigger a tactical event
    event_res = client.post("/api/events/trigger", json={
        "event_type": EventType.RUNWAY_BLOCKED.value,
        "payload": {"airbase_id": "BASE_TRISHUL"},
    })
    assert event_res.status_code == 200

    # Retrieve updated session
    session_res = client.get(f"/api/replay/sessions/{new_id}")
    assert session_res.status_code == 200
    updated_session = session_res.json()
    assert updated_session["event_count"] >= 2
    # Verify the event step was logged
    event_step = next((s for s in updated_session["steps"] if s["event_type"] == "RUNWAY_BLOCKED"), None)
    assert event_step is not None
    assert "BASE_TRISHUL" in event_step["affected_entity_ids"]
    assert event_step["severity"] == "CRITICAL"


def test_reset_scenario_preserves_earlier_sessions(client):
    """Verify that resetting scenario does not wipe existing recorded sessions."""
    # List sessions before reset
    list_before = client.get("/api/replay/sessions").json()
    count_before = len(list_before)

    # Perform scenario reset
    reset_res = client.post("/api/events/reset")
    assert reset_res.status_code == 200

    # List sessions after reset
    list_after = client.get("/api/replay/sessions").json()
    # Count should not decrease!
    assert len(list_after) >= count_before

    # Pre-seeded session still accessible
    res_seed = client.get("/api/replay/sessions/SES-AIRPOWER-ALPHA-DEMO")
    assert res_seed.status_code == 200


def test_delete_replay_session(client):
    """Verify that deleting a session removes it from memory and persistent disk data."""
    # 1. Create a session to delete
    create_res = client.post("/api/replay/sessions", json={"scenario_name": "Session To Delete"})
    assert create_res.status_code == 201
    target_id = create_res.json()["session_id"]

    # Verify exists
    assert client.get(f"/api/replay/sessions/{target_id}").status_code == 200

    # 2. Delete the session
    del_res = client.delete(f"/api/replay/sessions/{target_id}")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "SUCCESS"
    assert del_data["deleted_session_id"] == target_id

    # 3. Verify session is gone from GET endpoint
    assert client.get(f"/api/replay/sessions/{target_id}").status_code == 404

    # 4. Verify deleting non-existent session returns 404
    assert client.delete(f"/api/replay/sessions/{target_id}").status_code == 404

