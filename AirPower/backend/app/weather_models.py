"""
Data models for Live Weather & Environmental Risk Assessment.
Normalized schemas for Open-Meteo observations, hourly forecasts,
rule-based risk evaluation, weather alerts, and synthetic scenario simulations.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WeatherRiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"


class WeatherAlertCategory(str, Enum):
    WIND = "WIND"
    PRECIPITATION = "PRECIPITATION"
    VISIBILITY = "VISIBILITY"
    THUNDERSTORM = "THUNDERSTORM"
    STALE_DATA = "STALE_DATA"
    EXTREME_TEMPERATURE = "EXTREME_TEMPERATURE"


class WeatherAlertSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class ContributingFactor(BaseModel):
    factor: str
    measured_value: Any
    threshold_value: Any
    severity: str  # "MODERATE" | "HIGH" | "INFO"
    is_forecast: bool = False
    timestamp: str
    rule_triggered: str
    explanation: str


class EnvironmentalRiskAssessment(BaseModel):
    overall_risk: WeatherRiskLevel
    confidence: str  # "HIGH" | "MODERATE" | "LOW" | "UNAVAILABLE"
    is_forecast: bool = False
    evaluated_at: str
    contributing_factors: List[ContributingFactor] = Field(default_factory=list)
    summary_assessment: str
    advisory_notice: str = (
        "ADVISORY ONLY: Rule-based environmental risk model. "
        "Does not supersede official military METAR/TAF, ATC directives, or formal flight safety release."
    )


class CurrentWeather(BaseModel):
    time: str
    temperature_c: float
    relative_humidity_pct: float
    precipitation_mm: float
    rain_mm: float
    weather_code: int
    weather_description: str
    cloud_cover_pct: float
    pressure_hpa: float
    wind_speed_kmh: float
    wind_direction_deg: float
    wind_gusts_kmh: float
    visibility_m: Optional[float] = None


class HourlyForecastItem(BaseModel):
    time: str
    temperature_c: float
    precipitation_probability_pct: Optional[float] = None
    precipitation_mm: float
    rain_mm: float
    weather_code: int
    weather_description: str
    cloud_cover_pct: float
    pressure_hpa: float
    wind_speed_kmh: float
    wind_direction_deg: float
    wind_gusts_kmh: float
    visibility_m: Optional[float] = None
    forecast_risk: Optional[EnvironmentalRiskAssessment] = None


class AirbaseWeatherData(BaseModel):
    airbase_id: str
    airbase_name: str
    lat: float
    lng: float
    current: Optional[CurrentWeather] = None
    hourly: List[HourlyForecastItem] = Field(default_factory=list)
    observation_time: Optional[str] = None
    data_source: str = "Open-Meteo WMO Numerical Model"
    provider_name: str = "Open-Meteo Global Meteorological API"
    last_updated: str
    status: str = "LIVE"  # "LIVE" | "SIMULATED" | "STALE" | "ERROR" | "NO_DATA"
    is_live: bool = True
    is_synthetic: bool = False
    is_stale: bool = False
    error_message: Optional[str] = None
    risk_assessment: EnvironmentalRiskAssessment
    live_backup: Optional[Dict[str, Any]] = None  # Preserves actual live data during scenario simulation


class WeatherAlert(BaseModel):
    alert_id: str
    airbase_id: str
    airbase_name: str
    category: WeatherAlertCategory
    severity: WeatherAlertSeverity
    triggering_variable: str
    measured_value: str
    threshold_value: str
    observation_timestamp: str
    created_at: str
    data_source: str = "Open-Meteo API / Environmental Risk Engine"
    acknowledged: bool = False
    status: str = "ACTIVE"  # "ACTIVE" | "CLEARED" | "ACKNOWLEDGED"
    message: str


class WeatherRiskConfig(BaseModel):
    # Configurable threshold parameters (no magic numbers scattered in code)
    wind_speed_moderate_kmh: float = 35.0
    wind_speed_high_kmh: float = 55.0
    wind_gust_moderate_kmh: float = 45.0
    wind_gust_high_kmh: float = 65.0
    precipitation_moderate_mm: float = 2.5
    precipitation_heavy_mm: float = 7.5
    visibility_low_meters: float = 5000.0
    visibility_critical_meters: float = 1500.0
    cloud_cover_high_pct: float = 85.0
    stale_threshold_minutes: int = 60
    severe_weather_codes: List[int] = Field(
        default_factory=lambda: [95, 96, 99, 45, 48, 65, 67, 75, 82, 86]
    )


class WeatherScenarioType(str, Enum):
    GALE_WINDS = "GALE_WINDS"
    MONSOON_DOWNPOUR = "MONSOON_DOWNPOUR"
    DENSE_FOG = "DENSE_FOG"
    THUNDERSTORM_SQUALL = "THUNDERSTORM_SQUALL"


class WeatherScenarioRequest(BaseModel):
    scenario_type: WeatherScenarioType
    airbase_id: str
    custom_label: Optional[str] = None


class WeatherStateResponse(BaseModel):
    airbases: List[AirbaseWeatherData]
    alerts: List[WeatherAlert]
    theatre_summary: Dict[str, Any]
    config: WeatherRiskConfig
    simulated_airbase_ids: List[str]
    last_synced_at: str
    data_provider: str = "Open-Meteo (Free Global Numerical Weather Prediction)"


class TaskWeatherImpactResponse(BaseModel):
    departure_airbase: Optional[AirbaseWeatherData] = None
    target_location_weather: Optional[AirbaseWeatherData] = None
    scheduled_time: Optional[str] = None
    target_id: Optional[str] = None
    combined_risk: WeatherRiskLevel
    primary_risk_factors: List[ContributingFactor]
    advisory_recommendation: str
    data_freshness_status: str
