"""
Automated Unit and Integration Tests for Phase 1 Core Capabilities:
- Data Fusion and Freshness Verification
- Event Log and Provenance
- Scenario Simulation Results & Before/After Comparison
- Maintenance and Logistics Management
- Approval Workflow and Role-Based Permissions
- Historical Analytics and Forecasting
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    AircraftStatus,
    ApprovalStatus,
    EventType,
    InventoryStatus,
    MaintenanceStatus,
    RunwayStatus,
)
from app.state import state_store


@pytest.fixture(autouse=True)
def reset_state():
    """Ensure clean baseline before each test."""
    state_store.reset_to_initial()


@pytest.fixture
def client():
    return TestClient(app)


def test_data_fusion_trust_report(client):
    """Test Gap 1: Data Fusion trust assessment, collection freshness, and anomaly rules."""
    res = client.get("/api/data-fusion/trust")
    assert res.status_code == 200
    report = res.json()

    assert "overall_quality_score" in report
    assert report["overall_quality_score"] > 0
    assert len(report["sources"]) >= 7

    # Verify overdue maintenance detection in anomalies
    assert len(report["anomalies"]) >= 1
    overdue_anomalies = [a for a in report["anomalies"] if a["rule_name"] == "OVERDUE_DEPOT_MAINTENANCE"]
    assert len(overdue_anomalies) >= 1
    assert overdue_anomalies[0]["severity"] == "CRITICAL"


def test_maintenance_work_order_lifecycle(client):
    """Test Gap 4A: Maintenance Work Order creation and status transition."""
    # 1. List work orders
    list_res = client.get("/api/maintenance")
    assert list_res.status_code == 200
    initial_orders = list_res.json()
    assert len(initial_orders) >= 4

    # 2. Create new work order
    create_res = client.post("/api/maintenance", json={
        "resource_id": "AC_RAFALE_02",
        "resource_type": "AIRCRAFT",
        "category": "SCHEDULED_INSPECTION",
        "priority": "HIGH",
        "airbase_id": "BASE_TRISHUL",
        "planned_start": "2026-10-15T08:00:00Z",
        "planned_completion": "2026-10-16T12:00:00Z",
        "estimated_duration_hours": 16.0,
        "description": "50-hr post-flight telemetry inspection",
        "technician_lead": "Sergeant V. Patil",
    })
    assert create_res.status_code == 201
    new_wo = create_res.json()
    wo_id = new_wo["record_id"]
    assert new_wo["status"] == "OPEN"

    # 3. Transition to IN_PROGRESS
    patch_res = client.patch(f"/api/maintenance/{wo_id}/status", json={
        "status": "IN_PROGRESS",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "IN_PROGRESS"

    # 4. Complete work order
    complete_res = client.patch(f"/api/maintenance/{wo_id}/status", json={
        "status": "COMPLETED",
        "actual_duration_hours": 14.5,
    })
    assert complete_res.status_code == 200
    completed_data = complete_res.json()
    assert completed_data["status"] == "COMPLETED"
    assert completed_data["actual_completion"] is not None


def test_support_inventory_management(client):
    """Test Gap 4B: Support inventory queries and stock adjustment."""
    # 1. List inventory
    inv_res = client.get("/api/inventory")
    assert inv_res.status_code == 200
    items = inv_res.json()
    assert len(items) >= 5

    first_item = items[0]
    item_id = first_item["item_id"]
    old_qty = first_item["quantity_on_hand"]

    # 2. Adjust inventory
    adj_res = client.patch(f"/api/inventory/{item_id}/adjust", json={
        "adjustment_quantity": -1,
        "reason": "Expedited dispatch for scheduled depot overhaul",
    })
    assert adj_res.status_code == 200
    assert adj_res.json()["quantity_on_hand"] == max(0, old_qty - 1)


def test_approval_workflow_and_rbac(client):
    """Test Gap 5: Human approval submission, mandatory rejection rationale, and role permissions."""
    # 1. List approvals
    app_res = client.get("/api/approvals")
    assert app_res.status_code == 200
    approvals = app_res.json()
    assert len(approvals) >= 2

    # Find a pending proposal
    pending = next((a for a in approvals if a["status"] == "PENDING"), None)
    assert pending is not None
    app_id = pending["approval_id"]

    # 2. Test RBAC: Unauthorised viewer role must be 403 Forbidden
    forbidden_res = client.post(f"/api/approvals/{app_id}/decide", json={
        "decision": "APPROVED",
        "reviewer_id": "CIVILIAN_GUEST",
        "reviewer_role": "VIEWER",
        "rationale": "Looks good to me",
    })
    assert forbidden_res.status_code == 403

    # 3. Test mandatory rejection rationale: Empty rationale must be 400 Bad Request
    no_rationale_res = client.post(f"/api/approvals/{app_id}/decide", json={
        "decision": "REJECTED",
        "reviewer_id": "OFF-WC-88",
        "reviewer_role": "WING_COMMANDER",
        "rationale": "",
    })
    assert no_rationale_res.status_code == 400

    # 4. Valid approval by authorized Wing Commander
    valid_res = client.post(f"/api/approvals/{app_id}/decide", json={
        "decision": "APPROVED",
        "reviewer_id": "OFF-WC-88",
        "reviewer_role": "WING_COMMANDER",
        "rationale": "Authorized per Squadron Operational Readiness Directive 14-B.",
    })
    assert valid_res.status_code == 200
    decided = valid_res.json()
    assert decided["status"] == "APPROVED"
    assert decided["decided_at"] is not None


def test_scenario_comparison_and_clean_reset(client):
    """Test Gap 3: Baseline capture, delta metric computation, and clean reset."""
    # 1. Trigger RUNWAY_BLOCKED scenario
    event_res = client.post("/api/events/trigger", json={
        "event_type": EventType.RUNWAY_BLOCKED.value,
        "payload": {"airbase_id": "BASE_TRISHUL"},
    })
    assert event_res.status_code == 200

    # 2. Retrieve comparison
    comp_res = client.get("/api/events/comparison")
    assert comp_res.status_code == 200
    comparison = comp_res.json()
    assert comparison is not None
    assert "metrics" in comparison
    assert len(comparison["metrics"]) >= 5

    # Base operational metric must reflect -1 base delta
    bases_metric = next(m for m in comparison["metrics"] if m["metric_name"] == "Operational Airbases")
    assert bases_metric["delta"] == -1.0
    assert bases_metric["impact"] == "DEGRADED"

    # Conflicts detected
    assert len(comparison["conflicts_detected"]) >= 1

    # 3. Clean reset
    reset_res = client.post("/api/events/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "RESET_SUCCESS"

    # Verify comparison is reset
    state_after = client.get("/api/state").json()
    assert state_after["active_scenario_comparison"] is None
    trishul = next(b for b in state_after["airbases"] if b["id"] == "BASE_TRISHUL")
    assert trishul["runway_status"] == RunwayStatus.OPERATIONAL.value


def test_historical_analytics_and_forecasting(client):
    """Test Gap 6: Historical trends and transparent predictive models."""
    # Historical analytics
    hist_res = client.get("/api/analytics/historical?days=30")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist["readiness_trend"]) >= 10
    assert len(hist["work_orders_throughput"]) >= 10
    assert "metadata" in hist

    # Forecasting
    fc_res = client.get("/api/analytics/forecast?days=14")
    assert fc_res.status_code == 200
    fc = fc_res.json()
    assert fc["forecast_horizon_days"] == 14
    assert len(fc["maintenance_workload_forecast"]) == 14
    assert len(fc["inventory_depletion_forecast"]) >= 5
    assert fc["confidence_level"] > 80.0
    assert "SYNTHETIC" in fc["synthetic_notice"].upper()
