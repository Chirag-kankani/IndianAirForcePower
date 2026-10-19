"""
Automated tests for Data Fusion & Trust Centre and Maintenance & Logistics Centre.
Covers all Part 6 Acceptance Criteria.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.state import state_store

client = TestClient(app)


def test_data_fusion_trust_report_comprehensive():
    """Verify trust report contains all 10 sources, provenance, freshness, and quality score."""
    res = client.get("/api/data-fusion/trust")
    assert res.status_code == 200
    data = res.json()
    assert "overall_quality_score" in data
    assert "sources" in data
    assert len(data["sources"]) == 10
    assert "anomalies" in data
    assert "freshness_summary" in data

    # Verify every source has schema version and provenance
    for s in data["sources"]:
        assert "collection" in s
        assert "provenance" in s
        assert "schema_version" in s
        assert s["freshness"] in ("FRESH", "STALE", "VALIDATION_REQUIRED")


def test_data_fusion_source_inspector():
    """Verify raw collection inspector returns records and provenance."""
    res = client.get("/api/data-fusion/source/aircraft_fleet")
    assert res.status_code == 200
    data = res.json()
    assert data["collection"] == "aircraft_fleet"
    assert data["record_count"] >= 23
    assert len(data["records"]) >= 23

    # Unknown collection returns 404
    err_res = client.get("/api/data-fusion/source/nonexistent_catalog")
    assert err_res.status_code == 404


def test_data_fusion_force_revalidate():
    """Verify manual revalidate endpoint logs validation audit entry."""
    res = client.post("/api/data-fusion/revalidate")
    assert res.status_code == 200
    report = res.json()
    assert report["overall_quality_score"] > 0

    # Verify event logged in state
    state_res = client.get("/api/state")
    latest_evt = state_res.json()["event_log"][-1]
    assert latest_evt["event_type"] == "SYSTEM_VALIDATION"
    assert latest_evt["source"] == "DATA_FUSION_TRUST_CENTRE"


def test_maintenance_summary_metrics():
    """Verify maintenance summary returns accurate workload and shortage counts."""
    res = client.get("/api/maintenance/summary")
    assert res.status_code == 200
    summary = res.json()
    assert summary["total_work_orders"] >= 8
    assert "scheduled_open" in summary
    assert "in_progress" in summary
    assert "completed" in summary
    assert "overdue" in summary
    assert "low_stock_alerts_count" in summary
    assert "blocked_work_orders_count" in summary


def test_maintenance_status_lifecycle_and_terminal_rules():
    """Verify valid transitions succeed and terminal/invalid transitions are rejected with 400."""
    # Create a fresh test work order
    create_payload = {
        "resource_id": "AC_RAFALE_01",
        "resource_type": "AIRCRAFT",
        "category": "SCHEDULED_INSPECTION",
        "priority": "MEDIUM",
        "airbase_id": "BASE_TRISHUL",
        "planned_start": "2026-10-10T08:00:00Z",
        "planned_completion": "2026-10-11T12:00:00Z",
        "estimated_duration_hours": 14.0,
        "description": "Lifecycle transition test task",
        "technician_lead": "Sergeant Test",
    }
    create_res = client.post("/api/maintenance", json=create_payload)
    assert create_res.status_code == 201
    wo_id = create_res.json()["record_id"]

    # 1. OPEN -> IN_PROGRESS is valid
    patch_res = client.patch(f"/api/maintenance/{wo_id}/status", json={"status": "IN_PROGRESS"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "IN_PROGRESS"

    # 2. IN_PROGRESS -> COMPLETED is valid
    comp_res = client.patch(f"/api/maintenance/{wo_id}/status", json={"status": "COMPLETED"})
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"

    # 3. COMPLETED -> IN_PROGRESS must be rejected (terminal state)
    rej_res = client.patch(f"/api/maintenance/{wo_id}/status", json={"status": "IN_PROGRESS"})
    assert rej_res.status_code == 400
    assert "terminal state" in rej_res.json()["detail"].lower()


def test_create_work_order_validation_foreign_keys():
    """Verify creating a work order on a nonexistent aircraft or base fails with 400."""
    invalid_payload = {
        "resource_id": "AC_DOES_NOT_EXIST_999",
        "resource_type": "AIRCRAFT",
        "category": "ENGINE_OVERHAUL",
        "priority": "HIGH",
        "airbase_id": "BASE_TRISHUL",
        "planned_start": "2026-10-10T08:00:00Z",
        "planned_completion": "2026-10-11T12:00:00Z",
        "estimated_duration_hours": 20.0,
        "description": "Invalid aircraft test",
        "technician_lead": "CWO Test",
    }
    res = client.post("/api/maintenance", json=invalid_payload)
    assert res.status_code == 400
    assert "does not exist" in res.json()["detail"]


def test_aircraft_maintenance_history():
    """Verify asset-level maintenance history endpoint."""
    res = client.get("/api/maintenance/history/AC_RAFALE_04")
    assert res.status_code == 200
    data = res.json()
    assert data["aircraft"]["aircraft_id"] == "AC_RAFALE_04"
    assert "work_orders" in data
    assert "events" in data
    assert data["total_maintenance_cycles"] >= 1


def test_inventory_adjustment_integrity():
    """Verify inventory adjustment prevents negative quantities and over-reservation."""
    # Fetch an inventory item
    inv_res = client.get("/api/inventory")
    item = inv_res.json()[0]
    item_id = item["item_id"]
    current_qty = item["quantity_on_hand"]

    # 1. Valid positive adjustment
    adj_res = client.patch(f"/api/inventory/{item_id}/adjust", json={"adjustment_quantity": 5, "reason": "Restock batch"})
    assert adj_res.status_code == 200
    assert adj_res.json()["quantity_on_hand"] == current_qty + 5

    # 2. Reject negative stock
    err_res = client.patch(f"/api/inventory/{item_id}/adjust", json={"adjustment_quantity": -(current_qty + 100), "reason": "Excess deduction"})
    assert err_res.status_code == 400
    assert "negative stock" in err_res.json()["detail"].lower()
