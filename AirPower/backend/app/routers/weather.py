"""
Weather Router: Live Meteorological Intelligence, Environmental Risk Evaluation,
Alert Deduplication, and Injector-driven Scenario Simulation.
Uses Open-Meteo Global API with local memory cache, transparent rule engine,
and isolated simulation states.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models import EventLogEntry, EventType, StateSnapshot
from app.replay_service import replay_service
from app.state import state_store
from app.websocket import manager
from app.weather_models import (
    AirbaseWeatherData,
    ContributingFactor,
    TaskWeatherImpactResponse,
    WeatherAlert,
    WeatherRiskConfig,
    WeatherRiskLevel,
    WeatherScenarioRequest,
    WeatherStateResponse,
)
from app.weather_service import weather_service

router = APIRouter(prefix="/api/weather", tags=["Weather & Environmental Risk"])


@router.get(
    "/theatre",
    response_model=WeatherStateResponse,
    summary="Get theatre-wide weather intelligence and risk assessments for all airbases",
)
async def get_theatre_weather_endpoint(
    force_refresh: bool = Query(False, description="Bypass cache and force fresh Open-Meteo query")
) -> WeatherStateResponse:
    snapshot = state_store.get_snapshot()
    if not snapshot or not snapshot.airbases:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System state not initialized or airbases missing.",
        )

    airbases_data, alerts = await weather_service.get_theatre_weather(
        snapshot.airbases, force_refresh=force_refresh
    )

    high_risk_count = sum(1 for ab in airbases_data if ab.risk_assessment.overall_risk == WeatherRiskLevel.HIGH)
    mod_risk_count = sum(1 for ab in airbases_data if ab.risk_assessment.overall_risk == WeatherRiskLevel.MODERATE)
    low_risk_count = sum(1 for ab in airbases_data if ab.risk_assessment.overall_risk == WeatherRiskLevel.LOW)
    unknown_risk_count = sum(1 for ab in airbases_data if ab.risk_assessment.overall_risk == WeatherRiskLevel.UNKNOWN)

    simulated_ids = list(weather_service._simulation_overrides.keys())

    summary = {
        "total_monitored_airbases": len(airbases_data),
        "low_risk_count": low_risk_count,
        "moderate_risk_count": mod_risk_count,
        "high_risk_count": high_risk_count,
        "unknown_risk_count": unknown_risk_count,
        "active_alerts_count": len(alerts),
        "simulated_airbases_count": len(simulated_ids),
        "theatre_environmental_status": "ADVERSE" if high_risk_count > 0 else ("CAUTION" if mod_risk_count > 0 else "NOMINAL"),
        "primary_provider": weather_service.provider_name,
        "provider_attribution": weather_service.provider_attribution,
        "cache_freshness_seconds": weather_service._cache_ttl_seconds,
    }

    now_iso = datetime.now(timezone.utc).isoformat()

    return WeatherStateResponse(
        airbases=airbases_data,
        alerts=alerts,
        theatre_summary=summary,
        config=weather_service.config,
        simulated_airbase_ids=simulated_ids,
        last_synced_at=now_iso,
        data_provider=weather_service.provider_name,
    )


@router.get(
    "/airbase/{airbase_id}",
    response_model=AirbaseWeatherData,
    summary="Get weather and hourly forecast for a specific airbase",
)
async def get_airbase_weather_endpoint(
    airbase_id: str,
    force_refresh: bool = Query(False, description="Bypass cache and force fresh Open-Meteo query")
) -> AirbaseWeatherData:
    snapshot = state_store.get_snapshot()
    if not snapshot:
        raise HTTPException(status_code=503, detail="State not initialized")

    airbase = next((ab for ab in snapshot.airbases if ab.id == airbase_id), None)
    if not airbase:
        raise HTTPException(status_code=404, detail=f"Airbase '{airbase_id}' not found.")

    if airbase.lat is None or airbase.lng is None:
        raise HTTPException(
            status_code=400,
            detail=f"Airbase '{airbase.name}' has no registered geographical coordinates. Cannot fabricate weather.",
        )

    # Check simulation override first
    if airbase.id in weather_service._simulation_overrides:
        return weather_service._simulation_overrides[airbase.id]

    data = await weather_service.fetch_airbase_weather_live(
        base_id=airbase.id,
        base_name=airbase.name,
        lat=airbase.lat,
        lng=airbase.lng,
        force_refresh=force_refresh,
    )
    return data


@router.get(
    "/alerts",
    summary="List active weather alerts and historical alert audit log",
)
async def get_weather_alerts_endpoint():
    active = list(weather_service._active_alerts.values())
    history = weather_service.get_alert_history()
    return {
        "active_alerts": active,
        "historical_alerts": history,
        "total_active": len(active),
        "total_historical": len(history),
    }


@router.post(
    "/alerts/{alert_id}/acknowledge",
    summary="Acknowledge an active weather alert",
)
async def acknowledge_weather_alert_endpoint(alert_id: str):
    success = weather_service.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Active alert '{alert_id}' not found.")

    await manager.broadcast(
        "WEATHER_ALERT_ACKNOWLEDGED",
        {
            "alert_id": alert_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"status": "SUCCESS", "alert_id": alert_id, "acknowledged": True}


@router.post(
    "/simulate",
    response_model=AirbaseWeatherData,
    summary="Inject a synthetic weather hazard scenario into an airbase (Injector Tool)",
)
async def inject_weather_scenario_endpoint(req: WeatherScenarioRequest) -> AirbaseWeatherData:
    snapshot = state_store.get_snapshot()
    if not snapshot:
        raise HTTPException(status_code=503, detail="State not initialized")

    airbase = next((ab for ab in snapshot.airbases if ab.id == req.airbase_id), None)
    if not airbase:
        raise HTTPException(status_code=404, detail=f"Airbase '{req.airbase_id}' not found.")

    # Execute simulation injection
    sim_data = weather_service.inject_weather_scenario(
        airbase_id=airbase.id,
        airbase_name=airbase.name,
        lat=airbase.lat,
        lng=airbase.lng,
        scenario_type=req.scenario_type,
        custom_label=req.custom_label,
    )

    event_id = f"EVT-WTR-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    desc = (
        f"[WEATHER INJECTOR] Synthetic scenario {req.scenario_type.value} injected at {airbase.name}. "
        f"Resulting environmental risk: {sim_data.risk_assessment.overall_risk.value}."
    )

    # Record in event log
    def _log_mutator(snap: StateSnapshot):
        log_entry = EventLogEntry(
            event_id=event_id,
            timestamp=now_iso,
            event_type=EventType.WEATHER_SCENARIO_INJECTED.value,
            entity_type="AIRBASE",
            entity_id=airbase.id,
            severity="WARNING" if sim_data.risk_assessment.overall_risk == WeatherRiskLevel.MODERATE else "CRITICAL",
            source="WEATHER_SIMULATOR",
            description=desc,
            affected_assets=[airbase.id],
            retasking_actions=[],
            details={
                "scenario_type": req.scenario_type.value,
                "airbase_id": airbase.id,
                "overall_risk": sim_data.risk_assessment.overall_risk.value,
                "is_synthetic": True,
            },
        )
        snap.event_log.append(log_entry)
        return [], desc, snap.model_copy(deep=True)

    await state_store.mutate(_log_mutator)

    # Record in Replay Service
    replay_service.record_step(
        event_id=event_id,
        event_type=EventType.WEATHER_SCENARIO_INJECTED.value,
        title=f"Synthetic Weather Hazard: {req.scenario_type.value}",
        description=desc,
        severity="WARNING" if sim_data.risk_assessment.overall_risk == WeatherRiskLevel.MODERATE else "CRITICAL",
        affected_entity_ids=[airbase.id],
        state_delta={"weather_scenario": req.scenario_type.value, "airbase_id": airbase.id},
        updated_snapshot=state_store.get_snapshot(),
    )

    # Broadcast WebSocket update
    await manager.broadcast(
        "WEATHER_UPDATE",
        {
            "action": "SCENARIO_INJECTED",
            "airbase_id": airbase.id,
            "scenario_type": req.scenario_type.value,
            "overall_risk": sim_data.risk_assessment.overall_risk.value,
            "timestamp": now_iso,
        },
    )

    return sim_data


@router.post(
    "/simulate/reset",
    summary="Reset synthetic weather simulations back to live observations",
)
async def reset_weather_scenario_endpoint(
    airbase_id: Optional[str] = Query(None, description="Optional specific airbase to reset. If omitted, resets all.")
):
    cleared = weather_service.reset_weather_simulation(airbase_id=airbase_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    desc = f"[WEATHER INJECTOR] Synthetic weather simulation reset for {len(cleared)} base(s): {', '.join(cleared) if cleared else 'All'}. Live data restored."

    event_id = f"EVT-WTR-RST-{uuid.uuid4().hex[:6].upper()}"

    def _reset_mutator(snap: StateSnapshot):
        log_entry = EventLogEntry(
            event_id=event_id,
            timestamp=now_iso,
            event_type=EventType.WEATHER_SCENARIO_RESET.value,
            entity_type="AIRBASE",
            entity_id=airbase_id or "ALL",
            severity="INFO",
            source="WEATHER_SIMULATOR",
            description=desc,
            affected_assets=cleared,
            retasking_actions=[],
            details={"cleared_airbase_ids": cleared},
        )
        snap.event_log.append(log_entry)
        return [], desc, snap.model_copy(deep=True)

    await state_store.mutate(_reset_mutator)

    replay_service.record_step(
        event_id=event_id,
        event_type=EventType.WEATHER_SCENARIO_RESET.value,
        title="Weather Simulation Reset",
        description=desc,
        severity="INFO",
        affected_entity_ids=cleared,
        state_delta={"cleared": cleared},
        updated_snapshot=state_store.get_snapshot(),
    )

    await manager.broadcast(
        "WEATHER_UPDATE",
        {
            "action": "SCENARIO_RESET",
            "cleared_airbase_ids": cleared,
            "timestamp": now_iso,
        },
    )

    return {
        "status": "SUCCESS",
        "message": desc,
        "cleared_airbases": cleared,
        "live_data_restored": True,
    }


@router.get(
    "/task-impact",
    response_model=TaskWeatherImpactResponse,
    summary="Evaluate environmental risk impact on a proposed flight task or mission",
)
async def get_task_weather_impact_endpoint(
    departure_airbase_id: str = Query(..., description="Departure airbase ID"),
    target_id: Optional[str] = Query(None, description="Mission target ID"),
    scheduled_time: Optional[str] = Query(None, description="Scheduled sortie departure time (ISO format)"),
) -> TaskWeatherImpactResponse:
    snapshot = state_store.get_snapshot()
    if not snapshot:
        raise HTTPException(status_code=503, detail="State not initialized")

    airbase = next((ab for ab in snapshot.airbases if ab.id == departure_airbase_id), None)
    if not airbase:
        raise HTTPException(status_code=404, detail=f"Airbase '{departure_airbase_id}' not found.")

    # Fetch or retrieve weather data
    if airbase.id in weather_service._simulation_overrides:
        ab_weather = weather_service._simulation_overrides[airbase.id]
    else:
        ab_weather = await weather_service.fetch_airbase_weather_live(
            base_id=airbase.id,
            base_name=airbase.name,
            lat=airbase.lat,
            lng=airbase.lng,
        )

    # Determine risk from departure base
    risk = ab_weather.risk_assessment
    primary_factors = list(risk.contributing_factors)

    # Check if scheduled time falls into hourly forecast
    forecast_match = None
    if scheduled_time and ab_weather.hourly:
        # Match nearest hour
        for h in ab_weather.hourly:
            if scheduled_time[:13] in h.time:
                forecast_match = h
                break

    if forecast_match and forecast_match.forecast_risk:
        combined_risk = forecast_match.forecast_risk.overall_risk
        for factor in forecast_match.forecast_risk.contributing_factors:
            if not any(f.factor == factor.factor for f in primary_factors):
                primary_factors.append(factor)
        freshness_status = f"FORECAST_BASED ({forecast_match.time})"
    else:
        combined_risk = risk.overall_risk
        freshness_status = "CURRENT_OBSERVATION" if ab_weather.is_live else "SYNTHETIC_SIMULATION"

    # Advisory recommendation
    if combined_risk == WeatherRiskLevel.HIGH:
        recommendation = (
            f"HIGH RISK ADVISORY: Adverse meteorological conditions at {airbase.name}. "
            "Exceeds typical operational weather minimums. Exercise extreme caution; consider standby or delay."
        )
    elif combined_risk == WeatherRiskLevel.MODERATE:
        recommendation = (
            f"MODERATE RISK ADVISORY: Marginally adverse conditions at {airbase.name}. "
            "Continuous weather monitoring required for recovery airfield."
        )
    elif combined_risk == WeatherRiskLevel.UNKNOWN:
        recommendation = "UNKNOWN RISK ADVISORY: Insufficient or missing weather observations. Verify airfield status with ATC."
    else:
        recommendation = f"LOW RISK: Environmental parameters at {airbase.name} are within nominal flight operations envelope."

    return TaskWeatherImpactResponse(
        departure_airbase=ab_weather,
        target_location_weather=None,
        scheduled_time=scheduled_time,
        target_id=target_id,
        combined_risk=combined_risk,
        primary_risk_factors=primary_factors,
        advisory_recommendation=recommendation,
        data_freshness_status=freshness_status,
    )
