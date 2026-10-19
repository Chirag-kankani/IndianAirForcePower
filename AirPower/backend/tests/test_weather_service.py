"""
Comprehensive Tests for Live Weather & Environmental Risk Assessment Service.
Validates Open-Meteo integration, rule engine thresholds, alert deduplication,
synthetic scenario injection/reset, and API endpoints.
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models import Airbase, RunwayStatus
from app.weather_models import (
    AirbaseWeatherData,
    WeatherAlertCategory,
    WeatherAlertSeverity,
    WeatherRiskConfig,
    WeatherRiskLevel,
    WeatherScenarioType,
)
from app.weather_service import WeatherService, weather_service
from app.state import state_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_state_loaded():
    state_store.load_from_disk()
    # Reset any lingering synthetic simulation
    weather_service.reset_weather_simulation()


# -----------------------------------------------------------------------------
# 1. Rule Engine & Threshold Trigger Tests
# -----------------------------------------------------------------------------
def test_environmental_risk_rules_nominal_low():
    service = WeatherService()
    # Nominal conditions: wind 15 km/h, gust 20 km/h, rain 0, clear sky
    now_iso = datetime.now(timezone.utc).isoformat()
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=15.0,
        wind_gusts_kmh=20.0,
        precipitation_mm=0.0,
        visibility_m=10000.0,
        weather_code=0,
        cloud_cover_pct=10.0,
        observation_time_iso=now_iso,
        is_forecast=False,
        is_stale=False,
    )
    assert assessment.overall_risk == WeatherRiskLevel.LOW
    assert len(assessment.contributing_factors) == 0
    assert assessment.is_forecast is False


def test_environmental_risk_rules_moderate_wind():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    # Moderate sustained wind (>= 35 km/h)
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=40.0,
        wind_gusts_kmh=48.0,
        precipitation_mm=0.0,
        visibility_m=10000.0,
        weather_code=1,
        cloud_cover_pct=20.0,
        observation_time_iso=now_iso,
    )
    assert assessment.overall_risk == WeatherRiskLevel.MODERATE
    assert any(f.rule_triggered == "RULE_WIND_SPEED_CAUTION" for f in assessment.contributing_factors)


def test_environmental_risk_rules_high_gale_wind():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    # Critical gale wind (>= 55 km/h) and severe gusts (>= 65 km/h)
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=68.0,
        wind_gusts_kmh=85.0,
        precipitation_mm=1.0,
        visibility_m=8000.0,
        weather_code=2,
        cloud_cover_pct=50.0,
        observation_time_iso=now_iso,
    )
    assert assessment.overall_risk == WeatherRiskLevel.HIGH
    assert any(f.rule_triggered == "RULE_WIND_SPEED_CRITICAL" for f in assessment.contributing_factors)
    assert any(f.rule_triggered == "RULE_GUST_SPEED_CRITICAL" for f in assessment.contributing_factors)


def test_environmental_risk_rules_heavy_torrential_rain():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=20.0,
        wind_gusts_kmh=25.0,
        precipitation_mm=14.5,  # >= 7.5 mm heavy rain limit
        visibility_m=4000.0,
        weather_code=65,
        cloud_cover_pct=100.0,
        observation_time_iso=now_iso,
    )
    assert assessment.overall_risk == WeatherRiskLevel.HIGH
    assert any("Precipitation" in f.factor or "Rain" in f.factor for f in assessment.contributing_factors)


def test_environmental_risk_rules_critical_visibility_fog():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=5.0,
        wind_gusts_kmh=8.0,
        precipitation_mm=0.0,
        visibility_m=400.0,  # Below 1500m CAT-I minimum
        weather_code=45,
        cloud_cover_pct=90.0,
        observation_time_iso=now_iso,
    )
    assert assessment.overall_risk == WeatherRiskLevel.HIGH
    assert any(f.rule_triggered == "RULE_VISIBILITY_CRITICAL" for f in assessment.contributing_factors)


def test_environmental_risk_rules_severe_thunderstorm():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=28.0,
        wind_gusts_kmh=40.0,
        precipitation_mm=3.0,
        visibility_m=5000.0,
        weather_code=99,  # Severe thunderstorm with heavy hail
        cloud_cover_pct=95.0,
        observation_time_iso=now_iso,
    )
    assert assessment.overall_risk == WeatherRiskLevel.HIGH
    assert any("Thunderstorm" in f.factor for f in assessment.contributing_factors)


def test_environmental_risk_stale_data_flag():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=10.0,
        wind_gusts_kmh=15.0,
        precipitation_mm=0.0,
        visibility_m=10000.0,
        weather_code=0,
        cloud_cover_pct=10.0,
        observation_time_iso=now_iso,
        is_stale=True,
    )
    assert assessment.overall_risk == WeatherRiskLevel.MODERATE
    assert any(f.rule_triggered == "RULE_FRESHNESS_EXPIRED" for f in assessment.contributing_factors)


def test_environmental_risk_missing_variables_unknown():
    service = WeatherService()
    now_iso = datetime.now(timezone.utc).isoformat()
    assessment = service.evaluate_environmental_risk(
        wind_speed_kmh=None,
        wind_gusts_kmh=None,
        precipitation_mm=None,
        visibility_m=None,
        weather_code=None,
        cloud_cover_pct=None,
        observation_time_iso=now_iso,
    )
    assert assessment.overall_risk == WeatherRiskLevel.UNKNOWN


# -----------------------------------------------------------------------------
# 2. Alert Deduplication & Lifecycle Tests
# -----------------------------------------------------------------------------
def test_alert_deduplication():
    service = WeatherService()
    # Create fake airbase weather with HIGH gale wind
    ab_weather = service.inject_weather_scenario(
        airbase_id="BASE_TRISHUL",
        airbase_name="Trishul AFS",
        lat=30.36,
        lng=76.81,
        scenario_type=WeatherScenarioType.GALE_WINDS,
    )

    # First check generates alert
    assert len(service._active_alerts) > 0
    alert_count_before = len(service._active_alerts)

    # Calling check_and_generate_alerts again does not create a duplicate
    service._check_and_generate_alerts(ab_weather)
    assert len(service._active_alerts) == alert_count_before

    # Acknowledging alert
    alert_id = list(service._active_alerts.values())[0].alert_id
    acked = service.acknowledge_alert(alert_id)
    assert acked is True
    assert service._active_alerts[list(service._active_alerts.keys())[0]].acknowledged is True


# -----------------------------------------------------------------------------
# 3. Synthetic Simulation Isolation & Reset Tests
# -----------------------------------------------------------------------------
def test_simulation_does_not_overwrite_live_data():
    service = WeatherService()
    # Inject synthetic scenario
    sim_data = service.inject_weather_scenario(
        airbase_id="BASE_GARUDA",
        airbase_name="Garuda Base",
        lat=26.25,
        lng=73.04,
        scenario_type=WeatherScenarioType.MONSOON_DOWNPOUR,
    )
    assert sim_data.is_synthetic is True
    assert sim_data.is_live is False
    assert sim_data.current.rain_mm >= 14.0
    assert "BASE_GARUDA" in service._simulation_overrides

    # Reset simulation
    cleared = service.reset_weather_simulation("BASE_GARUDA")
    assert "BASE_GARUDA" in cleared
    assert "BASE_GARUDA" not in service._simulation_overrides


# -----------------------------------------------------------------------------
# 4. API Endpoints Integration Tests
# -----------------------------------------------------------------------------
def test_api_theatre_weather_endpoint():
    response = client.get("/api/weather/theatre")
    assert response.status_code == 200
    data = response.json()

    assert "airbases" in data
    assert len(data["airbases"]) > 0
    assert "theatre_summary" in data
    assert data["theatre_summary"]["total_monitored_airbases"] == len(data["airbases"])
    assert "data_provider" in data
    assert "Open-Meteo" in data["data_provider"]

    # Verify first airbase schema
    first_ab = data["airbases"][0]
    assert "airbase_id" in first_ab
    assert "risk_assessment" in first_ab
    assert first_ab["risk_assessment"]["overall_risk"] in ["LOW", "MODERATE", "HIGH", "UNKNOWN"]
    if first_ab.get("current"):
        assert "temperature_c" in first_ab["current"]
        assert "wind_speed_kmh" in first_ab["current"]


def test_api_airbase_missing_coordinates():
    # Attempting to fetch weather for an invalid or coordinate-less base
    response = client.get("/api/weather/airbase/NON_EXISTENT_BASE")
    assert response.status_code == 404


def test_api_simulate_and_reset_flow():
    # Inject scenario
    req_body = {
        "scenario_type": "THUNDERSTORM_SQUALL",
        "airbase_id": "BASE_TRISHUL",
    }
    sim_res = client.post("/api/weather/simulate", json=req_body)
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["is_synthetic"] is True
    assert sim_data["risk_assessment"]["overall_risk"] == "HIGH"

    # Verify theatre summary reflects simulated count
    theatre_res = client.get("/api/weather/theatre")
    assert theatre_res.status_code == 200
    assert "BASE_TRISHUL" in theatre_res.json()["simulated_airbase_ids"]

    # Reset simulation
    reset_res = client.post("/api/weather/simulate/reset?airbase_id=BASE_TRISHUL")
    assert reset_res.status_code == 200
    assert "BASE_TRISHUL" in reset_res.json()["cleared_airbases"]


def test_api_task_weather_impact():
    response = client.get("/api/weather/task-impact?departure_airbase_id=BASE_TRISHUL")
    assert response.status_code == 200
    data = response.json()
    assert "combined_risk" in data
    assert "advisory_recommendation" in data
    assert "departure_airbase" in data
    assert data["departure_airbase"]["airbase_id"] == "BASE_TRISHUL"
