import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Eye,
  EyeOff,
  Thermometer,
  Gauge,
  Compass,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Database,
  Radio,
  Sparkles,
  Info,
  Check,
  RotateCcw,
} from 'lucide-react';
import type {
  AirbaseWeatherData,
  WeatherAlert,
  WeatherRiskLevel,
  WeatherStateResponse,
  HourlyForecastItem,
  ContributingFactor,
} from '../types';
import {
  fetchTheatreWeather,
  acknowledgeWeatherAlert,
  injectWeatherScenario,
  resetWeatherScenario,
} from '../services/api';

interface WeatherDashboardProps {
  onSelectAirbaseOnMap?: (airbaseId: string) => void;
}

export const WeatherDashboard: React.FC<WeatherDashboardProps> = () => {
  const [weatherState, setWeatherState] = useState<WeatherStateResponse | null>(null);
  const [selectedAirbaseId, setSelectedAirbaseId] = useState<string | null>(null);
  const [selectedForecastIndex, setSelectedForecastIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);
      const data = await fetchTheatreWeather(forceRefresh);
      setWeatherState(data);
      if (!selectedAirbaseId && data.airbases.length > 0) {
        setSelectedAirbaseId(data.airbases[0].airbase_id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to retrieve meteorological telemetry');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedAirbaseId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 60000); // 1-minute auto refresh (uses 15m server cache)
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    setAcknowledgingId(alertId);
    try {
      await acknowledgeWeatherAlert(alertId);
      await loadData(false);
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const selectedAirbase: AirbaseWeatherData | undefined = weatherState?.airbases.find(
    (ab) => ab.airbase_id === selectedAirbaseId
  );

  const selectedHourlyItem: HourlyForecastItem | undefined =
    selectedAirbase?.hourly && selectedAirbase.hourly.length > selectedForecastIndex
      ? selectedAirbase.hourly[selectedForecastIndex]
      : undefined;

  const getRiskBadge = (level: WeatherRiskLevel) => {
    switch (level) {
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/50 flex items-center gap-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            HIGH RISK
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            MODERATE
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            LOW RISK
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-500/20 text-slate-300 border border-slate-500/50 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            UNKNOWN
          </span>
        );
    }
  };

  const filteredAirbases = weatherState?.airbases.filter((ab) => {
    if (filterRisk === 'ALL') return true;
    return ab.risk_assessment.overall_risk === filterRisk;
  }) || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 font-mono text-xs select-none">
      {/* ─── HEADER BAR & DATA SOURCE REPUTATION ──────────────────────────── */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border border-cyan-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <CloudRain className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-wider text-white font-sans flex items-center gap-2">
                  WEATHER & ENVIRONMENTAL RISK
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    OPEN-METEO LIVE WMO
                  </span>
                </h1>
                <p className="text-slate-400 text-xs mt-0.5 font-mono">
                  Real-time meteorological observation, 24-hour predictive trend analysis, and rule-based sortie impact scoring.
                </p>
              </div>
            </div>
          </div>

          {/* Sync & Source Information */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-slate-300 text-[11px]">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Provider: <strong className="text-cyan-300 font-bold">Open-Meteo Global</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Cache: 15m</span>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing || isLoading}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 hover:text-white font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
              title="Force query Open-Meteo API bypassing local cache"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isRefreshing ? 'SYNCING...' : 'REFRESH LIVE'}</span>
            </button>
          </div>
        </div>

        {/* Advisory Legal / Safety Notice */}
        <div className="mt-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] flex items-center gap-2 font-mono">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>OPERATIONAL ADVISORY:</strong> This system applies rule-based thresholds on numerical weather models. It does not replace certified military METAR/TAF bulletins, ATC clearances, or flight commander sign-offs.
          </span>
        </div>
      </div>

      {/* ─── ERROR STATE ─────────────────────────────────────────────────── */}
      {errorMessage && (
        <div className="glass-panel p-4 rounded-xl border border-red-500/40 bg-red-950/20 text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="font-bold text-xs uppercase tracking-wider">Meteorological Data Telemetry Error</div>
              <div className="text-[11px] text-red-300 font-mono mt-0.5">{errorMessage}</div>
            </div>
          </div>
          <button
            onClick={() => loadData(true)}
            className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-400 text-red-200 hover:bg-red-500/30 text-xs font-bold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ─── THEATRE METEOROLOGICAL KPI SUMMARY ──────────────────────────── */}
      {weatherState && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Monitored Bases</span>
            <div className="text-xl md:text-2xl font-black text-white font-sans mt-1">
              {weatherState.theatre_summary.total_monitored_airbases}
            </div>
            <span className="text-[10px] text-cyan-400 mt-1">Live Coordinates</span>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/10 flex flex-col justify-between">
            <span className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider">Nominal Bases</span>
            <div className="text-xl md:text-2xl font-black text-emerald-300 font-sans mt-1">
              {weatherState.theatre_summary.low_risk_count}
            </div>
            <span className="text-[10px] text-emerald-400/80 mt-1">Clear Envelope</span>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/10 flex flex-col justify-between">
            <span className="text-amber-400 text-[10px] uppercase font-bold tracking-wider">Caution Bases</span>
            <div className="text-xl md:text-2xl font-black text-amber-300 font-sans mt-1">
              {weatherState.theatre_summary.moderate_risk_count}
            </div>
            <span className="text-[10px] text-amber-400/80 mt-1">Moderate Risk</span>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-red-500/30 bg-red-950/10 flex flex-col justify-between">
            <span className="text-red-400 text-[10px] uppercase font-bold tracking-wider">Adverse Bases</span>
            <div className="text-xl md:text-2xl font-black text-red-300 font-sans mt-1">
              {weatherState.theatre_summary.high_risk_count}
            </div>
            <span className="text-[10px] text-red-400/80 mt-1">Hazard Critical</span>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Alerts</span>
            <div className="text-xl md:text-2xl font-black text-cyan-300 font-sans mt-1">
              {weatherState.theatre_summary.active_alerts_count}
            </div>
            <span className="text-[10px] text-cyan-400/80 mt-1">Deduplicated</span>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-950/10 flex flex-col justify-between">
            <span className="text-indigo-400 text-[10px] uppercase font-bold tracking-wider">Simulated Injected</span>
            <div className="text-xl md:text-2xl font-black text-indigo-300 font-sans mt-1">
              {weatherState.theatre_summary.simulated_airbases_count}
            </div>
            <span className="text-[10px] text-indigo-400/80 mt-1">Synthetic Layer</span>
          </div>
        </div>
      )}

      {/* ─── MAIN TWO-COLUMN SPLIT: AIRBASES (LEFT) vs DETAILED HOURLY FORECAST (RIGHT) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: AIRBASE CARDS (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-sans">AIRBASE WEATHER MATRIX</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {filteredAirbases.length} BASES
              </span>
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {['ALL', 'HIGH', 'MODERATE', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterRisk(lvl)}
                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                    filterRisk === lvl
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredAirbases.map((ab) => {
              const isSelected = ab.airbase_id === selectedAirbaseId;
              const curr = ab.current;
              const risk = ab.risk_assessment;
              return (
                <div
                  key={ab.airbase_id}
                  onClick={() => {
                    setSelectedAirbaseId(ab.airbase_id);
                    setSelectedForecastIndex(0);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'glass-panel border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50 bg-slate-900/90'
                      : 'glass-panel border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  {/* Top: Name & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white font-sans">{ab.airbase_name}</span>
                        {ab.is_synthetic && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 font-bold">
                            SYNTHETIC
                          </span>
                        )}
                        {ab.is_stale && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold">
                            STALE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {ab.airbase_id} • {ab.lat.toFixed(2)}°N, {ab.lng.toFixed(2)}°E
                      </div>
                    </div>
                    {getRiskBadge(risk.overall_risk)}
                  </div>

                  {/* Conditions Strip */}
                  {curr ? (
                    <div className="grid grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
                      <div>
                        <span className="text-slate-500 text-[9px] block">TEMP</span>
                        <span className="text-slate-200 font-bold flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-cyan-400" />
                          {curr.temperature_c.toFixed(1)}°C
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[9px] block">WIND</span>
                        <span className="text-slate-200 font-bold flex items-center gap-1">
                          <Wind className="w-3 h-3 text-sky-400" />
                          {curr.wind_speed_kmh.toFixed(0)} <span className="text-[9px] font-normal text-slate-400">km/h</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[9px] block">GUSTS</span>
                        <span className={`font-bold flex items-center gap-1 ${curr.wind_gusts_kmh >= 55 ? 'text-amber-400' : 'text-slate-200'}`}>
                          <Gauge className="w-3 h-3 text-amber-400" />
                          {curr.wind_gusts_kmh.toFixed(0)} <span className="text-[9px] font-normal text-slate-400">km/h</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[9px] block">RAIN</span>
                        <span className={`font-bold flex items-center gap-1 ${curr.rain_mm > 0 ? 'text-cyan-400' : 'text-slate-300'}`}>
                          <CloudRain className="w-3 h-3 text-cyan-400" />
                          {curr.rain_mm.toFixed(1)} <span className="text-[9px] font-normal text-slate-400">mm</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic mt-2">No observation data available.</div>
                  )}

                  {/* Top Risk Factor (if any) */}
                  {risk.contributing_factors.length > 0 && (
                    <div className="mt-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[10px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">
                        <strong>{risk.contributing_factors[0].factor}:</strong> {risk.contributing_factors[0].explanation}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED HOURLY FORECAST & RISK AUDIT (7 COLS) */}
        <div className="lg:col-span-7 space-y-5">
          {selectedAirbase ? (
            <>
              {/* CURRENT OBSERVATION DEEP-DIVE CARD */}
              <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white font-sans">{selectedAirbase.airbase_name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                        {selectedAirbase.airbase_id}
                      </span>
                      {selectedAirbase.is_synthetic && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                          SYNTHETIC INJECTION ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Observation Time: <strong>{selectedAirbase.current?.time ? new Date(selectedAirbase.current.time).toLocaleTimeString() : 'N/A'}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Source: {selectedAirbase.data_source}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getRiskBadge(selectedAirbase.risk_assessment.overall_risk)}
                  </div>
                </div>

                {/* CURRENT SENSORS GRID */}
                {selectedAirbase.current && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Conditions</span>
                      <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5 truncate">
                        <Cloud className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate">{selectedAirbase.current.weather_description}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Code {selectedAirbase.current.weather_code} (WMO)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Wind Envelope</span>
                      <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                        <Wind className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>{selectedAirbase.current.wind_speed_kmh.toFixed(1)} km/h</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Gusts: <strong className="text-amber-300">{selectedAirbase.current.wind_gusts_kmh.toFixed(1)} km/h</strong>
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Visibility / Ceiling</span>
                      <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {selectedAirbase.current.visibility_m !== undefined && selectedAirbase.current.visibility_m !== null
                            ? `${(selectedAirbase.current.visibility_m / 1000).toFixed(1)} km`
                            : 'Unknown'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Cloud Cover: {selectedAirbase.current.cloud_cover_pct.toFixed(0)}%
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Barometric & Humidity</span>
                      <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{selectedAirbase.current.pressure_hpa.toFixed(0)} hPa</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Humidity: {selectedAirbase.current.relative_humidity_pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Risk Explanation Box */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                      Rule-Based Environmental Assessment
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Confidence: {selectedAirbase.risk_assessment.confidence}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    {selectedAirbase.risk_assessment.summary_assessment}
                  </p>

                  {selectedAirbase.risk_assessment.contributing_factors.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Triggered Hazard Factors:
                      </span>
                      {selectedAirbase.risk_assessment.contributing_factors.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-slate-900/80 border border-slate-800/80 text-[11px] flex items-start gap-2"
                        >
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            f.severity === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {f.severity}
                          </span>
                          <div>
                            <span className="font-bold text-white">{f.factor}: </span>
                            <span className="text-slate-300">{f.explanation} </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              (Observed: {f.measured_value} vs Threshold: {f.threshold_value})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── 24-HOUR HOURLY PREDICTIVE TIMELINE ─────────────────────── */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                      24-HOUR PREDICTIVE HOURLY TIMELINE
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold">
                        OPEN-METEO NUMERICAL FORECAST
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select an hour to evaluate projected environmental parameters and scheduled sortie impact.
                    </p>
                  </div>
                </div>

                {/* Horizontal Scrollable Hourly Cards */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {selectedAirbase.hourly.slice(0, 24).map((item, idx) => {
                    const isSelected = selectedForecastIndex === idx;
                    const itemDate = new Date(item.time);
                    const hourStr = itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    const fRisk = item.forecast_risk?.overall_risk || 'LOW';

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedForecastIndex(idx)}
                        className={`min-w-[95px] p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between shrink-0 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)] text-white'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span>{hourStr}</span>
                          <span className={`w-2 h-2 rounded-full ${
                            fRisk === 'HIGH' ? 'bg-red-400 shadow-[0_0_6px_red]' : (fRisk === 'MODERATE' ? 'bg-amber-400' : 'bg-emerald-400')
                          }`} />
                        </div>

                        <div className="my-2">
                          <div className="text-sm font-black text-white font-sans">{item.temperature_c.toFixed(0)}°C</div>
                          <div className="text-[10px] text-slate-300 flex items-center gap-1 mt-0.5">
                            <Wind className="w-3 h-3 text-sky-400" />
                            <span>{item.wind_speed_kmh.toFixed(0)} <span className="text-[8px] text-slate-500">km/h</span></span>
                          </div>
                        </div>

                        <div className="text-[9px] text-slate-400 truncate">
                          {item.weather_description}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SELECTED FORECAST HOUR INSPECTOR CARD */}
                {selectedHourlyItem && (
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">
                          FORECAST AT {new Date(selectedHourlyItem.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({new Date(selectedHourlyItem.time).toLocaleDateString()})
                        </span>
                      </div>
                      {selectedHourlyItem.forecast_risk && getRiskBadge(selectedHourlyItem.forecast_risk.overall_risk)}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[9px] block">TEMP / CLOUDS</span>
                        <span className="text-white font-bold">{selectedHourlyItem.temperature_c.toFixed(1)}°C</span>
                        <span className="text-slate-400 text-[10px] block">{selectedHourlyItem.cloud_cover_pct.toFixed(0)}% cloud</span>
                      </div>

                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[9px] block">WIND & GUSTS</span>
                        <span className="text-white font-bold">{selectedHourlyItem.wind_speed_kmh.toFixed(1)} km/h</span>
                        <span className="text-amber-300 text-[10px] block">Gusts: {selectedHourlyItem.wind_gusts_kmh.toFixed(1)} km/h</span>
                      </div>

                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[9px] block">RAIN / PRECIP</span>
                        <span className="text-white font-bold">{selectedHourlyItem.precipitation_mm.toFixed(1)} mm</span>
                        <span className="text-slate-400 text-[10px] block">
                          Prob: {selectedHourlyItem.precipitation_probability_pct ?? 0}%
                        </span>
                      </div>

                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[9px] block">PROJECTED RISK</span>
                        <span className={`font-bold ${
                          selectedHourlyItem.forecast_risk?.overall_risk === 'HIGH'
                            ? 'text-red-400'
                            : (selectedHourlyItem.forecast_risk?.overall_risk === 'MODERATE' ? 'text-amber-400' : 'text-emerald-400')
                        }`}>
                          {selectedHourlyItem.forecast_risk?.overall_risk || 'LOW'}
                        </span>
                        <span className="text-slate-400 text-[10px] block truncate">
                          {selectedHourlyItem.weather_description}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-500">
              Select an airbase to inspect meteorological telemetry and hourly forecast.
            </div>
          )}
        </div>
      </div>

      {/* ─── ENVIRONMENTAL ALERTS & AUDIT PANEL (SECTION E) ───────────────── */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white font-sans">
              ACTIVE ENVIRONMENTAL HAZARD ALERTS & AUDIT LOG
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
              {weatherState?.alerts.length ?? 0} ACTIVE
            </span>
          </div>
        </div>

        {weatherState?.alerts && weatherState.alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weatherState.alerts.map((al) => (
              <div
                key={al.alert_id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
                  al.severity === 'CRITICAL'
                    ? 'bg-red-950/20 border-red-500/50 text-red-200'
                    : 'bg-amber-950/20 border-amber-500/50 text-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{al.airbase_name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-900 text-slate-300 border border-slate-700">
                        {al.category}
                      </span>
                      {al.acknowledged && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          ACKNOWLEDGED
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Alert ID: {al.alert_id} • Created: {new Date(al.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    al.severity === 'CRITICAL' ? 'bg-red-500/30 text-red-200' : 'bg-amber-500/30 text-amber-200'
                  }`}>
                    {al.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-sans">{al.message}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                  <span className="text-slate-400">
                    Threshold: <strong className="text-slate-200">{al.threshold_value}</strong>
                  </span>
                  {!al.acknowledged && (
                    <button
                      onClick={() => handleAcknowledgeAlert(al.alert_id)}
                      disabled={acknowledgingId === al.alert_id}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>{acknowledgingId === al.alert_id ? 'ACKING...' : 'ACKNOWLEDGE'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-500 text-center italic">
            No active environmental hazard alerts across the operational theatre. All monitored airbases within nominal safety envelopes.
          </div>
        )}
      </div>

      {/* ─── SECTION D: TRANSPARENT RULE ENGINE THRESHOLD REFERENCE ────────── */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white font-sans uppercase tracking-wider">
            TRANSPARENT RULE ENGINE & THRESHOLD SPECIFICATION
          </h3>
        </div>
        <p className="text-[11px] text-slate-400">
          Thresholds are configured in the backend risk engine (<code className="text-cyan-300 font-mono">WeatherRiskConfig</code>). If observations or forecast parameters violate these limits, risks are automatically classified and deduplicated alerts are emitted.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-[11px]">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold block">Sustained Wind Limits</span>
            <div className="text-slate-300">Moderate: <strong>≥ 35.0 km/h</strong></div>
            <div className="text-red-300">High Risk: <strong>≥ 55.0 km/h</strong></div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold block">Wind Gust Limits</span>
            <div className="text-slate-300">Moderate: <strong>≥ 45.0 km/h</strong></div>
            <div className="text-red-300">High Risk: <strong>≥ 65.0 km/h</strong></div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold block">Precipitation Limits</span>
            <div className="text-slate-300">Moderate: <strong>≥ 2.5 mm/h</strong></div>
            <div className="text-red-300">Heavy Rain: <strong>≥ 7.5 mm/h</strong></div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold block">Visibility & Ceilings</span>
            <div className="text-slate-300">Low Vis: <strong>≤ 5000 m</strong></div>
            <div className="text-red-300">Critical: <strong>≤ 1500 m (Below CAT-I)</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};
