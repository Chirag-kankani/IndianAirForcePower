"""
Weather Service: Centralized live weather acquisition, normalization,
rule-based environmental risk assessment, alert generation, and synthetic scenario simulation.
Integrates with Open-Meteo API (free, reliable, coordinates-based global weather).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.models import Airbase
from app.weather_models import (
    AirbaseWeatherData,
    ContributingFactor,
    CurrentWeather,
    EnvironmentalRiskAssessment,
    HourlyForecastItem,
    WeatherAlert,
    WeatherAlertCategory,
    WeatherAlertSeverity,
    WeatherRiskConfig,
    WeatherRiskLevel,
    WeatherScenarioType,
)

# Standard WMO Weather Interpretation Codes
WMO_CODE_TABLE: Dict[int, str] = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog / Ground Mist",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Light Freezing Drizzle",
    57: "Dense Freezing Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Torrential Rain",
    66: "Light Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Slight Snow Fall",
    73: "Moderate Snow Fall",
    75: "Heavy Snow Fall",
    77: "Snow Grains",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm (Moderate)",
    96: "Thunderstorm with Slight Hail",
    99: "Severe Thunderstorm with Heavy Hail / Microburst",
}


class WeatherService:
    """
    Centralized weather intelligence provider.
    Maintains memory cache, throttles API requests, computes rule-based risk,
    and supports isolated synthetic scenario simulation without corrupting live data.
    """

    def __init__(self, config: Optional[WeatherRiskConfig] = None):
        self.config = config or WeatherRiskConfig()
        self._cache: Dict[str, Dict[str, Any]] = {}  # airbase_id -> { "data": AirbaseWeatherData, "cached_at": datetime }
        self._cache_ttl_seconds = 900  # 15 minutes cache freshness
        self._simulation_overrides: Dict[str, AirbaseWeatherData] = {}  # Isolated synthetic simulation state
        self._active_alerts: Dict[str, WeatherAlert] = {}  # alert_key -> WeatherAlert
        self._alert_history: List[WeatherAlert] = []
        self._lock = asyncio.Lock()
        self.provider_name = "Open-Meteo Global Meteorological API"
        self.provider_attribution = "Weather data provided by Open-Meteo (WMO Numerical Weather Prediction)"

    def get_weather_description(self, code: int) -> str:
        return WMO_CODE_TABLE.get(code, f"Code {code} (Atmospheric Phenomenon)")

    # -------------------------------------------------------------------------
    # RULE-BASED ENVIRONMENTAL RISK ASSESSMENT ENGINE
    # -------------------------------------------------------------------------
    def evaluate_environmental_risk(
        self,
        wind_speed_kmh: Optional[float],
        wind_gusts_kmh: Optional[float],
        precipitation_mm: Optional[float],
        visibility_m: Optional[float],
        weather_code: Optional[int],
        cloud_cover_pct: Optional[float],
        observation_time_iso: str,
        is_forecast: bool = False,
        is_stale: bool = False,
    ) -> EnvironmentalRiskAssessment:
        """
        Rule-based risk evaluator. Compares measurements against configured thresholds.
        Classifications: LOW, MODERATE, HIGH, UNKNOWN.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        factors: List[ContributingFactor] = []

        if is_stale:
            factors.append(
                ContributingFactor(
                    factor="Data Staleness Exceeded",
                    measured_value="Stale Telemetry",
                    threshold_value=f"<{self.config.stale_threshold_minutes} mins",
                    severity="MODERATE",
                    is_forecast=is_forecast,
                    timestamp=observation_time_iso,
                    rule_triggered="RULE_FRESHNESS_EXPIRED",
                    explanation=f"Observation timestamp is older than {self.config.stale_threshold_minutes} minutes.",
                )
            )

        # 1. High Wind Speed Rule
        if wind_speed_kmh is not None:
            if wind_speed_kmh >= self.config.wind_speed_high_kmh:
                factors.append(
                    ContributingFactor(
                        factor="Severe Crosswind / High Sustained Wind",
                        measured_value=f"{wind_speed_kmh:.1f} km/h",
                        threshold_value=f"≥ {self.config.wind_speed_high_kmh:.1f} km/h",
                        severity="HIGH",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_WIND_SPEED_CRITICAL",
                        explanation=f"Sustained wind speed of {wind_speed_kmh:.1f} km/h creates significant aerodynamic crosswind limits on runway operations.",
                    )
                )
            elif wind_speed_kmh >= self.config.wind_speed_moderate_kmh:
                factors.append(
                    ContributingFactor(
                        factor="Elevated Sustained Wind",
                        measured_value=f"{wind_speed_kmh:.1f} km/h",
                        threshold_value=f"≥ {self.config.wind_speed_moderate_kmh:.1f} km/h",
                        severity="MODERATE",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_WIND_SPEED_CAUTION",
                        explanation=f"Sustained wind speed of {wind_speed_kmh:.1f} km/h warrants crew monitoring for takeoff/recovery envelopes.",
                    )
                )

        # 2. Wind Gusts Rule
        if wind_gusts_kmh is not None:
            if wind_gusts_kmh >= self.config.wind_gust_high_kmh:
                factors.append(
                    ContributingFactor(
                        factor="Dangerous Wind Gusts / Shear",
                        measured_value=f"{wind_gusts_kmh:.1f} km/h",
                        threshold_value=f"≥ {self.config.wind_gust_high_kmh:.1f} km/h",
                        severity="HIGH",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_GUST_SPEED_CRITICAL",
                        explanation=f"Peak gusts of {wind_gusts_kmh:.1f} km/h pose severe risk of low-altitude wind shear and directional instability.",
                    )
                )
            elif wind_gusts_kmh >= self.config.wind_gust_moderate_kmh:
                factors.append(
                    ContributingFactor(
                        factor="Moderate Wind Gusts",
                        measured_value=f"{wind_gusts_kmh:.1f} km/h",
                        threshold_value=f"≥ {self.config.wind_gust_moderate_kmh:.1f} km/h",
                        severity="MODERATE",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_GUST_SPEED_CAUTION",
                        explanation=f"Gust activity reaches {wind_gusts_kmh:.1f} km/h. Flight controls require active turbulence compensation.",
                    )
                )

        # 3. Precipitation Intensity Rule
        if precipitation_mm is not None:
            if precipitation_mm >= self.config.precipitation_heavy_mm:
                factors.append(
                    ContributingFactor(
                        factor="Heavy Torrential Precipitation",
                        measured_value=f"{precipitation_mm:.1f} mm/h",
                        threshold_value=f"≥ {self.config.precipitation_heavy_mm:.1f} mm/h",
                        severity="HIGH",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_PRECIP_HEAVY",
                        explanation=f"Rainfall intensity of {precipitation_mm:.1f} mm/h induces standing water hydroplaning risks and engine water-ingestion limits.",
                    )
                )
            elif precipitation_mm >= self.config.precipitation_moderate_mm:
                factors.append(
                    ContributingFactor(
                        factor="Moderate Precipitation",
                        measured_value=f"{precipitation_mm:.1f} mm/h",
                        threshold_value=f"≥ {self.config.precipitation_moderate_mm:.1f} mm/h",
                        severity="MODERATE",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_PRECIP_MODERATE",
                        explanation=f"Rainfall of {precipitation_mm:.1f} mm/h reduces braking friction coefficient on concrete tarmac.",
                    )
                )

        # 4. Visibility Restrictions Rule
        if visibility_m is not None:
            if visibility_m <= self.config.visibility_critical_meters:
                factors.append(
                    ContributingFactor(
                        factor="Critical Low Visibility (CAT III Restriction)",
                        measured_value=f"{visibility_m / 1000.0:.2f} km ({int(visibility_m)} m)",
                        threshold_value=f"≤ {self.config.visibility_critical_meters / 1000.0:.1f} km",
                        severity="HIGH",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_VISIBILITY_CRITICAL",
                        explanation=f"Runway visual range (RVR) degraded to {int(visibility_m)} m. Disallows VFR operations; requires precision ILS CAT IIIB.",
                    )
                )
            elif visibility_m <= self.config.visibility_low_meters:
                factors.append(
                    ContributingFactor(
                        factor="Restricted Visibility / Haze",
                        measured_value=f"{visibility_m / 1000.0:.2f} km ({int(visibility_m)} m)",
                        threshold_value=f"≤ {self.config.visibility_low_meters / 1000.0:.1f} km",
                        severity="MODERATE",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_VISIBILITY_CAUTION",
                        explanation=f"Visibility reduced to {visibility_m / 1000.0:.2f} km. Visual contact distance restricted.",
                    )
                )

        # 5. Severe Weather Code (Thunderstorm / Squall / Freezing)
        if weather_code is not None:
            if weather_code in (95, 96, 99):
                factors.append(
                    ContributingFactor(
                        factor="Active Thunderstorm / Lightning / Hail",
                        measured_value=f"WMO Code {weather_code} ({self.get_weather_description(weather_code)})",
                        threshold_value="Convective Cell Detected",
                        severity="HIGH",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_SEVERE_CONVECTIVE_CELL",
                        explanation="Severe thunderstorm activity reported. Extreme updrafts/downdrafts and lightning hazards in terminal control area.",
                    )
                )
            elif weather_code in (45, 48):
                factors.append(
                    ContributingFactor(
                        factor="Dense Ground Fog / Freezing Rime",
                        measured_value=f"WMO Code {weather_code} ({self.get_weather_description(weather_code)})",
                        threshold_value="Fog Phenomenon",
                        severity="MODERATE",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_FOG_OBSCURATION",
                        explanation="Ground fog layer obscuring threshold lights and airfield navigation markings.",
                    )
                )

        # 6. High Cloud Ceiling Obscuration
        if cloud_cover_pct is not None and cloud_cover_pct >= self.config.cloud_cover_high_pct:
            if (precipitation_mm or 0) > 0 or (weather_code or 0) >= 50:
                factors.append(
                    ContributingFactor(
                        factor="Low Solid Overcast Ceiling",
                        measured_value=f"{cloud_cover_pct:.0f}% Cloud Cover",
                        threshold_value=f"≥ {self.config.cloud_cover_high_pct:.0f}%",
                        severity="MODERATE",
                        is_forecast=is_forecast,
                        timestamp=observation_time_iso,
                        rule_triggered="RULE_CEILING_OBSCURATION",
                        explanation=f"Extensive cloud deck ({cloud_cover_pct:.0f}%) impairs electro-optical sensor targeting and visual ground spotting.",
                    )
                )

        # Classify overall risk
        high_factors = [f for f in factors if f.severity == "HIGH"]
        mod_factors = [f for f in factors if f.severity == "MODERATE"]

        if high_factors:
            overall_risk = WeatherRiskLevel.HIGH
            summary = f"High environmental hazard detected ({len(high_factors)} critical factor(s): {high_factors[0].factor})."
            confidence = "HIGH"
        elif mod_factors:
            overall_risk = WeatherRiskLevel.MODERATE
            summary = f"Moderate environmental hazard ({len(mod_factors)} condition(s) requiring caution: {mod_factors[0].factor})."
            confidence = "HIGH"
        elif is_stale or wind_speed_kmh is None:
            overall_risk = WeatherRiskLevel.UNKNOWN
            summary = "Insufficient or stale meteorological telemetry to establish positive safety envelope."
            confidence = "LOW"
        else:
            overall_risk = WeatherRiskLevel.LOW
            summary = "Environmental conditions are within standard operational envelope thresholds."
            confidence = "HIGH"

        return EnvironmentalRiskAssessment(
            overall_risk=overall_risk,
            confidence=confidence,
            is_forecast=is_forecast,
            evaluated_at=now_iso,
            contributing_factors=factors,
            summary_assessment=summary,
        )

    # -------------------------------------------------------------------------
    # API FETCHER WITH CACHING & ERROR HANDLING
    # -------------------------------------------------------------------------
    async def fetch_airbase_weather_live(
        self,
        base_id: str,
        base_name: str,
        lat: float,
        lng: float,
        force_refresh: bool = False,
    ) -> AirbaseWeatherData:
        """
        Retrieves real-time weather and 24h hourly forecast for an airbase from Open-Meteo.
        Caches responses for 15 minutes to respect provider rate limits.
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Check Cache
        if not force_refresh and base_id in self._cache:
            entry = self._cache[base_id]
            cache_age = (now - entry["cached_at"]).total_seconds()
            if cache_age < self._cache_ttl_seconds:
                return entry["data"]

        # Request Open-Meteo API
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": (
                "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,"
                "cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility"
            ),
            "hourly": (
                "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,"
                "rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,"
                "wind_gusts_10m,visibility"
            ),
            "forecast_hours": 24,
            "timezone": "auto",
        }

        try:
            async with httpx.AsyncClient(timeout=7.0) as client:
                resp = await client.get(url, params=params)

            if resp.status_code != 200:
                raise RuntimeError(f"Open-Meteo returned HTTP {resp.status_code}: {resp.text[:120]}")

            raw = resp.json()
            curr_raw = raw.get("current", {})
            hourly_raw = raw.get("hourly", {})

            # Normalize Current Observation
            time_obs = curr_raw.get("time", now_iso)
            temp = float(curr_raw.get("temperature_2m", 25.0))
            humidity = float(curr_raw.get("relative_humidity_2m", 50.0))
            precip = float(curr_raw.get("precipitation", 0.0))
            rain = float(curr_raw.get("rain", 0.0))
            w_code = int(curr_raw.get("weather_code", 0))
            clouds = float(curr_raw.get("cloud_cover", 0.0))
            pressure = float(curr_raw.get("pressure_msl", 1013.2))
            w_speed = float(curr_raw.get("wind_speed_10m", 0.0))
            w_dir = float(curr_raw.get("wind_direction_10m", 0.0))
            w_gust = float(curr_raw.get("wind_gusts_10m", w_speed * 1.25))
            vis_m = float(curr_raw.get("visibility", 10000.0)) if curr_raw.get("visibility") is not None else None

            current_obj = CurrentWeather(
                time=time_obs,
                temperature_c=temp,
                relative_humidity_pct=humidity,
                precipitation_mm=precip,
                rain_mm=rain,
                weather_code=w_code,
                weather_description=self.get_weather_description(w_code),
                cloud_cover_pct=clouds,
                pressure_hpa=pressure,
                wind_speed_kmh=w_speed,
                wind_direction_deg=w_dir,
                wind_gusts_kmh=w_gust,
                visibility_m=vis_m,
            )

            # Evaluate Risk on Current Observation
            current_risk = self.evaluate_environmental_risk(
                wind_speed_kmh=w_speed,
                wind_gusts_kmh=w_gust,
                precipitation_mm=precip,
                visibility_m=vis_m,
                weather_code=w_code,
                cloud_cover_pct=clouds,
                observation_time_iso=time_obs,
                is_forecast=False,
                is_stale=False,
            )

            # Normalize Hourly Forecasts (up to 24 hours)
            hourly_items: List[HourlyForecastItem] = []
            h_times = hourly_raw.get("time", [])
            h_temps = hourly_raw.get("temperature_2m", [])
            h_precip_probs = hourly_raw.get("precipitation_probability", [])
            h_precips = hourly_raw.get("precipitation", [])
            h_rains = hourly_raw.get("rain", [])
            h_codes = hourly_raw.get("weather_code", [])
            h_clouds = hourly_raw.get("cloud_cover", [])
            h_pressures = hourly_raw.get("pressure_msl", [])
            h_winds = hourly_raw.get("wind_speed_10m", [])
            h_wind_dirs = hourly_raw.get("wind_direction_10m", [])
            h_gusts = hourly_raw.get("wind_gusts_10m", [])
            h_vis = hourly_raw.get("visibility", [])

            for idx in range(min(24, len(h_times))):
                item_time = h_times[idx]
                item_code = int(h_codes[idx]) if idx < len(h_codes) else 0
                item_wind = float(h_winds[idx]) if idx < len(h_winds) else 0.0
                item_gust = float(h_gusts[idx]) if idx < len(h_gusts) else item_wind * 1.2
                item_precip = float(h_precips[idx]) if idx < len(h_precips) else 0.0
                item_vis = float(h_vis[idx]) if idx < len(h_vis) and h_vis[idx] is not None else None
                item_clouds = float(h_clouds[idx]) if idx < len(h_clouds) else 0.0

                item_risk = self.evaluate_environmental_risk(
                    wind_speed_kmh=item_wind,
                    wind_gusts_kmh=item_gust,
                    precipitation_mm=item_precip,
                    visibility_m=item_vis,
                    weather_code=item_code,
                    cloud_cover_pct=item_clouds,
                    observation_time_iso=item_time,
                    is_forecast=True,
                    is_stale=False,
                )

                hourly_items.append(
                    HourlyForecastItem(
                        time=item_time,
                        temperature_c=float(h_temps[idx]) if idx < len(h_temps) else 20.0,
                        precipitation_probability_pct=float(h_precip_probs[idx]) if idx < len(h_precip_probs) else 0.0,
                        precipitation_mm=item_precip,
                        rain_mm=float(h_rains[idx]) if idx < len(h_rains) else 0.0,
                        weather_code=item_code,
                        weather_description=self.get_weather_description(item_code),
                        cloud_cover_pct=item_clouds,
                        pressure_hpa=float(h_pressures[idx]) if idx < len(h_pressures) else 1013.0,
                        wind_speed_kmh=item_wind,
                        wind_direction_deg=float(h_wind_dirs[idx]) if idx < len(h_wind_dirs) else 0.0,
                        wind_gusts_kmh=item_gust,
                        visibility_m=item_vis,
                        forecast_risk=item_risk,
                    )
                )

            data_obj = AirbaseWeatherData(
                airbase_id=base_id,
                airbase_name=base_name,
                lat=lat,
                lng=lng,
                current=current_obj,
                hourly=hourly_items,
                observation_time=time_obs,
                data_source="Open-Meteo WMO Numerical Weather API",
                provider_name=self.provider_name,
                last_updated=now_iso,
                status="LIVE",
                is_live=True,
                is_synthetic=False,
                is_stale=False,
                risk_assessment=current_risk,
            )

            # Store in cache
            self._cache[base_id] = {"data": data_obj, "cached_at": now}

            # Check and generate alerts if risk is HIGH or severe
            self._check_and_generate_alerts(data_obj)

            return data_obj

        except Exception as exc:
            # Fallback handling for provider downtime / network timeout:
            # DO NOT fabricate synthetic data silently!
            # If previous cached data exists, mark it as STALE. Otherwise mark as ERROR / NO_DATA.
            cached = self._cache.get(base_id)
            if cached:
                stale_data = cached["data"].model_copy(deep=True)
                stale_data.status = "STALE"
                stale_data.is_stale = True
                stale_data.error_message = f"Live update failed: {str(exc)}. Retaining previous cache."
                stale_data.risk_assessment = self.evaluate_environmental_risk(
                    wind_speed_kmh=stale_data.current.wind_speed_kmh if stale_data.current else None,
                    wind_gusts_kmh=stale_data.current.wind_gusts_kmh if stale_data.current else None,
                    precipitation_mm=stale_data.current.precipitation_mm if stale_data.current else None,
                    visibility_m=stale_data.current.visibility_m if stale_data.current else None,
                    weather_code=stale_data.current.weather_code if stale_data.current else None,
                    cloud_cover_pct=stale_data.current.cloud_cover_pct if stale_data.current else None,
                    observation_time_iso=stale_data.observation_time or now_iso,
                    is_forecast=False,
                    is_stale=True,
                )
                return stale_data

            # No cache at all: return explicit ERROR / NO_DATA state
            unknown_risk = EnvironmentalRiskAssessment(
                overall_risk=WeatherRiskLevel.UNKNOWN,
                confidence="UNAVAILABLE",
                is_forecast=False,
                evaluated_at=now_iso,
                contributing_factors=[
                    ContributingFactor(
                        factor="Weather API Provider Connection Failed",
                        measured_value="Connection Error",
                        threshold_value="Live HTTP 200",
                        severity="HIGH",
                        is_forecast=False,
                        timestamp=now_iso,
                        rule_triggered="RULE_PROVIDER_OUTAGE",
                        explanation=f"Unable to reach Open-Meteo weather endpoint: {str(exc)}",
                    )
                ],
                summary_assessment="Weather service offline or unreachable. Risk status UNKNOWN (missing data).",
            )

            return AirbaseWeatherData(
                airbase_id=base_id,
                airbase_name=base_name,
                lat=lat,
                lng=lng,
                current=None,
                hourly=[],
                observation_time=None,
                data_source="Open-Meteo API (Offline)",
                provider_name=self.provider_name,
                last_updated=now_iso,
                status="ERROR",
                is_live=False,
                is_synthetic=False,
                is_stale=False,
                error_message=f"Live weather lookup failed: {str(exc)}",
                risk_assessment=unknown_risk,
            )

    # -------------------------------------------------------------------------
    # THEATRE WEATHER STATE RESOLVER
    # -------------------------------------------------------------------------
    async def get_theatre_weather(
        self, airbases: List[Airbase], force_refresh: bool = False
    ) -> Tuple[List[AirbaseWeatherData], List[WeatherAlert]]:
        """
        Gathers weather for all supported airbases, overlaying any active synthetic simulation.
        """
        results: List[AirbaseWeatherData] = []

        # Fetch in parallel for all airbases
        tasks = [
            self.fetch_airbase_weather_live(
                base_id=b.id,
                base_name=b.name,
                lat=b.lat,
                lng=b.lng,
                force_refresh=force_refresh,
            )
            for b in airbases
        ]
        live_results = await asyncio.gather(*tasks)

        # Merge with simulation overrides (isolated simulation layer)
        for live_item in live_results:
            base_id = live_item.airbase_id
            if base_id in self._simulation_overrides:
                sim_item = self._simulation_overrides[base_id].model_copy(deep=True)
                # Ensure the original live data is preserved in live_backup for comparison
                sim_item.live_backup = live_item.model_dump()
                results.append(sim_item)
            else:
                results.append(live_item)

        # Collect active alerts
        alerts = list(self._active_alerts.values())
        return results, alerts

    # -------------------------------------------------------------------------
    # SYNTHETIC WEATHER SCENARIO SIMULATION (FOR THE INJECTOR SECTION)
    # -------------------------------------------------------------------------
    def inject_weather_scenario(
        self,
        airbase_id: str,
        airbase_name: str,
        lat: float,
        lng: float,
        scenario_type: WeatherScenarioType,
        custom_label: Optional[str] = None,
    ) -> AirbaseWeatherData:
        """
        Injects a synthetic weather scenario on an isolated simulation layer.
        Does NOT corrupt or destroy actual live weather observations.
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Build synthetic conditions based on the scenario
        if scenario_type == WeatherScenarioType.GALE_WINDS:
            wind_speed = 68.0
            wind_gusts = 88.0
            wind_dir = 285.0
            precip = 1.2
            rain = 1.0
            weather_code = 2  # Partly cloudy with severe crosswinds
            cloud_cover = 65.0
            pressure = 1004.0
            visibility = 7500.0
            temp = 22.0
            scenario_title = custom_label or "Gale-Force Crosswind Front (Synthetic)"

        elif scenario_type == WeatherScenarioType.MONSOON_DOWNPOUR:
            wind_speed = 46.0
            wind_gusts = 68.0
            wind_dir = 220.0
            precip = 28.5  # Torrential monsoon rain
            rain = 28.5
            weather_code = 65  # Heavy rain
            cloud_cover = 100.0
            pressure = 998.0
            visibility = 1200.0  # Degraded
            temp = 24.0
            scenario_title = custom_label or "Monsoon Cloudburst & Hydroplaning Hazard (Synthetic)"

        elif scenario_type == WeatherScenarioType.DENSE_FOG:
            wind_speed = 6.0
            wind_gusts = 9.0
            wind_dir = 140.0
            precip = 0.0
            rain = 0.0
            weather_code = 45  # Fog
            cloud_cover = 100.0
            pressure = 1018.0
            visibility = 350.0  # Critical runway lockout fog (<1500m)
            temp = 12.0
            scenario_title = custom_label or "Dense Radiation Fog / Zero-Ceiling Lockout (Synthetic)"

        elif scenario_type == WeatherScenarioType.THUNDERSTORM_SQUALL:
            wind_speed = 64.0
            wind_gusts = 96.0  # Severe microburst
            wind_dir = 310.0
            precip = 36.0
            rain = 34.0
            weather_code = 99  # Severe thunderstorm with heavy hail
            cloud_cover = 100.0
            pressure = 992.0
            visibility = 800.0
            temp = 19.0
            scenario_title = custom_label or "Severe Supercell Squall & Microburst (Synthetic)"

        else:
            wind_speed = 52.0
            wind_gusts = 70.0
            wind_dir = 270.0
            precip = 12.0
            rain = 12.0
            weather_code = 95
            cloud_cover = 90.0
            pressure = 1002.0
            visibility = 2500.0
            temp = 23.0
            scenario_title = "Synthetic Severe Weather Event"

        current_obj = CurrentWeather(
            time=now_iso,
            temperature_c=temp,
            relative_humidity_pct=92.0,
            precipitation_mm=precip,
            rain_mm=rain,
            weather_code=weather_code,
            weather_description=f"{self.get_weather_description(weather_code)} [{scenario_title}]",
            cloud_cover_pct=cloud_cover,
            pressure_hpa=pressure,
            wind_speed_kmh=wind_speed,
            wind_direction_deg=wind_dir,
            wind_gusts_kmh=wind_gusts,
            visibility_m=visibility,
        )

        sim_risk = self.evaluate_environmental_risk(
            wind_speed_kmh=wind_speed,
            wind_gusts_kmh=wind_gusts,
            precipitation_mm=precip,
            visibility_m=visibility,
            weather_code=weather_code,
            cloud_cover_pct=cloud_cover,
            observation_time_iso=now_iso,
            is_forecast=False,
            is_stale=False,
        )

        # Generate synthetic forecast showing continuation of storm for next 6 hours then clearing
        sim_hourly: List[HourlyForecastItem] = []
        for h in range(1, 13):
            decay = max(0.4, 1.0 - (h * 0.08))
            h_wind = round(wind_speed * decay, 1)
            h_gust = round(wind_gusts * decay, 1)
            h_precip = round(precip * decay, 1) if h < 6 else 0.0
            h_code = weather_code if h < 5 else (80 if h < 8 else 2)
            h_vis = min(10000.0, visibility + (h * 750.0))

            h_risk = self.evaluate_environmental_risk(
                wind_speed_kmh=h_wind,
                wind_gusts_kmh=h_gust,
                precipitation_mm=h_precip,
                visibility_m=h_vis,
                weather_code=h_code,
                cloud_cover_pct=max(20.0, cloud_cover * decay),
                observation_time_iso=now_iso,
                is_forecast=True,
                is_stale=False,
            )

            sim_hourly.append(
                HourlyForecastItem(
                    time=f"+{h}h Forecast",
                    temperature_c=round(temp + (h * 0.4), 1),
                    precipitation_probability_pct=max(10.0, round(90.0 * decay, 1)),
                    precipitation_mm=h_precip,
                    rain_mm=h_precip,
                    weather_code=h_code,
                    weather_description=self.get_weather_description(h_code),
                    cloud_cover_pct=max(20.0, round(cloud_cover * decay, 1)),
                    pressure_hpa=round(pressure + (h * 1.5), 1),
                    wind_speed_kmh=h_wind,
                    wind_direction_deg=wind_dir,
                    wind_gusts_kmh=h_gust,
                    visibility_m=h_vis,
                    forecast_risk=h_risk,
                )
            )

        # Extract live backup from cache if available
        live_backup_data = None
        if airbase_id in self._cache:
            live_backup_data = self._cache[airbase_id]["data"].model_dump()

        simulated_base_weather = AirbaseWeatherData(
            airbase_id=airbase_id,
            airbase_name=airbase_name,
            lat=lat,
            lng=lng,
            current=current_obj,
            hourly=sim_hourly,
            observation_time=now_iso,
            data_source=f"Synthetic Simulation Engine ({scenario_title})",
            provider_name="AirPower Scenario Injector (Synthetic Weather Model)",
            last_updated=now_iso,
            status="SIMULATED",
            is_live=False,
            is_synthetic=True,
            is_stale=False,
            risk_assessment=sim_risk,
            live_backup=live_backup_data,
        )

        self._simulation_overrides[airbase_id] = simulated_base_weather
        self._check_and_generate_alerts(simulated_base_weather)

        return simulated_base_weather

    def reset_weather_simulation(self, airbase_id: Optional[str] = None) -> List[str]:
        """
        Clears synthetic simulation and restores actual live observations.
        Does NOT erase historical event records.
        """
        cleared_ids: List[str] = []
        if airbase_id:
            if airbase_id in self._simulation_overrides:
                del self._simulation_overrides[airbase_id]
                cleared_ids.append(airbase_id)
        else:
            cleared_ids = list(self._simulation_overrides.keys())
            self._simulation_overrides.clear()

        # Clear synthetic alerts associated with cleared airbases
        for alert_id, alert in list(self._active_alerts.items()):
            if alert.airbase_id in cleared_ids and "Synthetic" in alert.data_source:
                alert.status = "CLEARED"
                del self._active_alerts[alert_id]

        return cleared_ids

    # -------------------------------------------------------------------------
    # ALERT GENERATION & DEDUPLICATION ENGINE
    # -------------------------------------------------------------------------
    def _check_and_generate_alerts(self, data: AirbaseWeatherData) -> None:
        """
        Evaluates risk factors and generates deduplicated alerts.
        Avoids creating duplicate active alerts on subsequent refreshes.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        risk = data.risk_assessment

        if risk.overall_risk not in (WeatherRiskLevel.HIGH, WeatherRiskLevel.MODERATE):
            # If conditions cleared, resolve existing active alerts for this airbase
            for key, alert in list(self._active_alerts.items()):
                if alert.airbase_id == data.airbase_id and alert.status == "ACTIVE":
                    alert.status = "CLEARED"
                    self._alert_history.append(alert)
                    del self._active_alerts[key]
            return

        for factor in risk.contributing_factors:
            category = WeatherAlertCategory.WIND
            if "Wind" in factor.factor or "Gust" in factor.factor:
                category = WeatherAlertCategory.WIND
            elif "Precip" in factor.factor or "Rain" in factor.factor:
                category = WeatherAlertCategory.PRECIPITATION
            elif "Visibility" in factor.factor or "Fog" in factor.factor:
                category = WeatherAlertCategory.VISIBILITY
            elif "Thunderstorm" in factor.factor or "Squall" in factor.factor:
                category = WeatherAlertCategory.THUNDERSTORM
            elif "Stale" in factor.factor:
                category = WeatherAlertCategory.STALE_DATA

            severity = (
                WeatherAlertSeverity.CRITICAL
                if factor.severity == "HIGH"
                else WeatherAlertSeverity.WARNING
            )

            # Deduplication Key: (airbase_id, category)
            alert_key = f"{data.airbase_id}:{category.value}"

            existing = self._active_alerts.get(alert_key)
            if existing and existing.status == "ACTIVE":
                # Already active, update measured value if significant change but keep ID & ack state
                existing.measured_value = str(factor.measured_value)
                continue

            alert_id = f"WTR-{data.airbase_id[:7]}-{category.value[:3]}-{int(datetime.now().timestamp()) % 10000:04d}"
            new_alert = WeatherAlert(
                alert_id=alert_id,
                airbase_id=data.airbase_id,
                airbase_name=data.airbase_name,
                category=category,
                severity=severity,
                triggering_variable=factor.factor,
                measured_value=str(factor.measured_value),
                threshold_value=str(factor.threshold_value),
                observation_timestamp=factor.timestamp,
                created_at=now_iso,
                data_source=data.data_source,
                acknowledged=False,
                status="ACTIVE",
                message=f"[{data.airbase_name}] {factor.factor}: {factor.measured_value} (Threshold: {factor.threshold_value}). {factor.explanation}",
            )
            self._active_alerts[alert_key] = new_alert
            self._alert_history.append(new_alert)

    def acknowledge_alert(self, alert_id: str) -> bool:
        """Marks an active weather alert as acknowledged."""
        for alert in self._active_alerts.values():
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                alert.status = "ACKNOWLEDGED"
                return True
        return False

    def get_alert_history(self) -> List[WeatherAlert]:
        return list(self._alert_history)


# Global Singleton Service Instance
weather_service = WeatherService()
