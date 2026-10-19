"""
Tests for StateStore and State API Router.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.state import state_store
from app.models import RunwayStatus


@pytest.fixture
def client():
    return TestClient(app)


def test_api_state_endpoint(client):
    """Test that GET /api/state returns a 200 and complete valid payload."""
    response = client.get("/api/state")
    assert response.status_code == 200
    data = response.json()

    assert "weapons_inventory" in data
    assert "aircraft_fleet" in data
    assert "airbases" in data
    assert "pilots" in data
    assert "threat_environment" in data
    assert "mission_targets" in data
    assert "active_missions" in data
    assert "event_log" in data
    assert len(data["aircraft_fleet"]) >= 12


def test_state_store_reset():
    """Verify that state_store can be mutated and cleanly reset."""
    initial_snapshot = state_store.get_snapshot()
    first_base_id = initial_snapshot.airbases[0].id

    # Mutate
    async def mutate_base():
        def _mutator(snap):
            snap.airbases[0].runway_status = RunwayStatus.BLOCKED
            return snap.airbases[0].runway_status
        return await state_store.mutate(_mutator)

    import asyncio
    asyncio.run(mutate_base())

    mutated_snapshot = state_store.get_snapshot()
    assert mutated_snapshot.airbases[0].runway_status == RunwayStatus.BLOCKED

    # Reset
    state_store.reset_to_initial()
    reset_snapshot = state_store.get_snapshot()
    assert reset_snapshot.airbases[0].runway_status == RunwayStatus.OPERATIONAL


def test_health_endpoint(client):
    """Test health and root endpoints."""
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["synthetic_data_badge"] == "SYNTHETIC DATA – DEMO"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "HEALTHY"
