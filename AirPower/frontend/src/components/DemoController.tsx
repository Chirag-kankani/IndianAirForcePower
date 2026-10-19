import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Radio,
  Wrench,
  RotateCcw,
  Play,
  ChevronUp,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle2,
  X,
  Flame,
  Lock,
  ChevronRight,
  GitCompare,
  CloudLightning,
  CloudRain,
  Wind,
  EyeOff,
  CloudSun,
} from 'lucide-react';
import type { Airbase, EventType, WeatherScenarioType } from '../types';
import { injectWeatherScenario, resetWeatherScenario } from '../services/api';

interface DemoControllerProps {
  onTriggerEvent: (eventType: EventType, payload?: Record<string, any>) => void;
  onResetScenario: () => void;
  onAutoDemo?: () => void;
  isProcessing: boolean;
  isAutoRunning?: boolean;
  airbases?: Airbase[];
  onOpenScenarioComparison?: () => void;
  hasActiveComparison?: boolean;
  onWeatherUpdated?: () => void;
}

export const DemoController: React.FC<DemoControllerProps> = ({
  onTriggerEvent,
  onResetScenario,
  onAutoDemo,
  isProcessing,
  isAutoRunning,
  airbases = [],
  onOpenScenarioComparison,
  hasActiveComparison = false,
  onWeatherUpdated,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Mod 12: runway picker popover state
  const [showRunwayPicker, setShowRunwayPicker] = useState(false);
  const runwayPickerRef = useRef<HTMLDivElement>(null);

  // Weather Hazard Injector state
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);
  const [selectedWeatherScenario, setSelectedWeatherScenario] =
    useState<WeatherScenarioType>('THUNDERSTORM_SQUALL');
  const [selectedWeatherAirbase, setSelectedWeatherAirbase] = useState<string>(
    airbases[0]?.id || 'BASE_TRISHUL'
  );
  const [isWeatherInjecting, setIsWeatherInjecting] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const weatherPickerRef = useRef<HTMLDivElement>(null);

  // Close runway picker on outside click
  useEffect(() => {
    if (!showRunwayPicker) return;
    const handler = (e: MouseEvent) => {
      if (runwayPickerRef.current && !runwayPickerRef.current.contains(e.target as Node)) {
        setShowRunwayPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRunwayPicker]);

  // Close weather picker on outside click
  useEffect(() => {
    if (!showWeatherPicker) return;
    const handler = (e: MouseEvent) => {
      if (weatherPickerRef.current && !weatherPickerRef.current.contains(e.target as Node)) {
        setShowWeatherPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWeatherPicker]);

  const handleInjectWeather = async () => {
    if (!selectedWeatherAirbase) return;
    setIsWeatherInjecting(true);
    setWeatherNotice(null);
    try {
      await injectWeatherScenario(selectedWeatherAirbase, selectedWeatherScenario);
      setWeatherNotice(`Injected ${selectedWeatherScenario} at ${selectedWeatherAirbase}`);
      if (onWeatherUpdated) onWeatherUpdated();
      onTriggerEvent('WEATHER_SCENARIO_INJECTED' as any, {
        airbase_id: selectedWeatherAirbase,
        scenario_type: selectedWeatherScenario,
      });
      setTimeout(() => setShowWeatherPicker(false), 900);
    } catch (err: any) {
      setWeatherNotice(err.message || 'Failed to inject weather hazard');
    } finally {
      setIsWeatherInjecting(false);
    }
  };

  const handleResetWeather = async () => {
    setIsWeatherInjecting(true);
    setWeatherNotice(null);
    try {
      await resetWeatherScenario(selectedWeatherAirbase);
      setWeatherNotice('Restored live Open-Meteo observations');
      if (onWeatherUpdated) onWeatherUpdated();
      onTriggerEvent('WEATHER_SCENARIO_RESET' as any, {
        airbase_id: selectedWeatherAirbase,
      });
      setTimeout(() => setShowWeatherPicker(false), 900);
    } catch (err: any) {
      setWeatherNotice(err.message || 'Failed to reset weather');
    } finally {
      setIsWeatherInjecting(false);
    }
  };

  const handleAction = async (actionKey: string, eventType: EventType, payload: Record<string, any> = {}) => {
    if (isProcessing || isAutoRunning) return;
    setActiveAction(actionKey);
    try {
      await onTriggerEvent(eventType, payload);
    } finally {
      setTimeout(() => setActiveAction(null), 800);
    }
  };

  const handleLockRunway = async (baseId: string) => {
    setShowRunwayPicker(false);
    await handleAction('RUNWAY', 'RUNWAY_BLOCKED', { airbase_id: baseId });
  };

  const handleConfirmReset = () => {
    setShowResetConfirm(false);
    onResetScenario();
  };

  if (isCollapsed) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="glass-panel-floating px-4 py-2 rounded-full border border-sky-400/40 text-sky-300 hover:text-white text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-[0_8px_30px_rgba(2,132,199,0.35)] cursor-pointer hover:border-sky-300 group"
          title="Expand Tactical Demo Controls"
        >
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <span>TACTICAL DEMO CONTROLS</span>
          <ChevronUp className="w-4 h-4 text-sky-400 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] select-none font-mono text-xs max-w-fit w-auto pointer-events-auto">
      <div className="glass-panel-floating px-3.5 py-1.5 rounded-2xl border border-sky-400/40 shadow-[0_12px_40px_rgba(2,132,199,0.3)] flex items-center gap-2 backdrop-blur-xl">
        {/* Badge & Operational Indicator */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-sky-500/25 shrink-0">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isAutoRunning ? 'bg-emerald-400' : isProcessing ? 'bg-amber-400' : 'bg-sky-400'
              } opacity-75`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isAutoRunning ? 'bg-emerald-400' : isProcessing ? 'bg-amber-400' : 'bg-sky-400'
              }`}
            ></span>
          </span>
          <span className="font-extrabold text-[11px] font-sans tracking-wide text-white flex items-center gap-1.5">
            INJECTOR
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30">
              {isAutoRunning ? 'RUNNING' : isProcessing ? 'ACTIVE' : 'READY'}
            </span>
          </span>
        </div>

        {/* 1. Runway Lockout Popover */}
        <div className="relative" ref={runwayPickerRef}>
          <button
            onClick={() => {
              if (!isProcessing && !isAutoRunning) setShowRunwayPicker((v) => !v);
            }}
            disabled={isProcessing || isAutoRunning}
            title="Lock out an airbase runway; triggers autonomous mid-flight divert"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              showRunwayPicker || activeAction === 'RUNWAY'
                ? 'bg-amber-500/35 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200 hover:border-amber-400'
            } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.15)]`}
          >
            {activeAction === 'RUNWAY' ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span>Lock Runway ▾</span>
          </button>

          {/* Upward popover */}
          {showRunwayPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-[500] w-64 glass-panel rounded-xl border border-amber-500/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Select Runway to Lock
                </span>
                <button
                  onClick={() => setShowRunwayPicker(false)}
                  className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-1.5 space-y-1 max-h-56 overflow-y-auto">
                {airbases.length === 0 && (
                  <div className="text-[10px] text-slate-500 italic text-center py-3">
                    No airbase data available.
                  </div>
                )}
                {airbases.map((base) => {
                  const isBlocked = base.runway_status === 'BLOCKED';
                  return (
                    <button
                      key={base.id}
                      onClick={() => !isBlocked && handleLockRunway(base.id)}
                      disabled={isBlocked}
                      title={isBlocked ? 'Runway already locked' : `Lock ${base.name}`}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono transition-all ${
                        isBlocked
                          ? 'opacity-45 cursor-not-allowed bg-slate-900/40'
                          : 'cursor-pointer hover:bg-amber-500/15 hover:border-amber-500/40 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isBlocked ? 'bg-rose-500' : 'bg-emerald-400'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-slate-100 leading-tight">{base.name}</div>
                          <div className="text-[9px] text-slate-500">
                            {base.lat.toFixed(2)}°N · {base.lng.toFixed(2)}°E
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            isBlocked
                              ? 'text-rose-400 border-rose-500/50 bg-rose-500/10'
                              : 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
                          }`}
                        >
                          {isBlocked ? 'LOCKED' : 'READY'}
                        </span>
                        {!isBlocked && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-3 py-1 border-t border-slate-800/80 text-[9px] text-slate-500 italic">
                Select base to trigger diversion.
              </div>
            </div>
          )}
        </div>

        {/* 2. Spawn SAM */}
        <button
          onClick={() =>
            handleAction('SAM', 'NEW_THREAT_ZONE', {
              name: 'Pop-Up S-400 Battery Sector',
              type: 'SAM_RADAR_BATTERY',
              lat: 31.15,
              lng: 75.35,
              radius_km: 65.0,
              severity: 5,
            })
          }
          disabled={isProcessing || isAutoRunning}
          title="Inject pop-up S-400 SAM missile radar corridor; calculates dynamic zero-threat detour"
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeAction === 'SAM'
              ? 'bg-red-500/35 border-red-400 text-red-200 ring-1 ring-red-400/50'
              : 'bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-red-200 hover:border-red-400'
          } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.15)]`}
        >
          {activeAction === 'SAM' ? (
            <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
          ) : (
            <Radio className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
          )}
          <span>Spawn SAM</span>
        </button>

        {/* 3. Jet Engine Fault */}
        <button
          onClick={() => handleAction('FAULT', 'AIRCRAFT_FAILURE', {})}
          disabled={isProcessing || isAutoRunning}
          title="Simulate turbine flameout on primary jet; triggers mission abort & autonomous standby scramble"
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeAction === 'FAULT'
              ? 'bg-rose-500/35 border-rose-400 text-rose-200 ring-1 ring-rose-400/50'
              : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-200 hover:border-rose-400'
          } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(244,63,94,0.15)]`}
        >
          {activeAction === 'FAULT' ? (
            <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
          ) : (
            <Wrench className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>Engine Fault</span>
        </button>

        {/* 3b. Weather Hazard Scenario Injector */}
        <div className="relative" ref={weatherPickerRef}>
          <button
            onClick={() => {
              if (!isProcessing && !isAutoRunning) setShowWeatherPicker((v) => !v);
            }}
            disabled={isProcessing || isAutoRunning}
            title="Inject synthetic meteorological hazard (Gale Winds, Downpour, Dense Fog, Thunderstorm Squall)"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              showWeatherPicker
                ? 'bg-sky-500/35 border-sky-400 text-sky-200 ring-1 ring-sky-400/50'
                : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-200 hover:border-sky-400'
            } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(14,165,233,0.15)]`}
          >
            {isWeatherInjecting ? (
              <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
            ) : (
              <CloudLightning className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span>Weather Hazard ▾</span>
          </button>

          {/* Upward popover */}
          {showWeatherPicker && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[500] w-80 glass-panel rounded-xl border border-sky-500/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between bg-sky-950/40">
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CloudLightning className="w-3.5 h-3.5 text-sky-400" />
                  Weather Hazard Injector
                </span>
                <button
                  onClick={() => setShowWeatherPicker(false)}
                  className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 space-y-2.5">
                {/* Target Airbase Selector */}
                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">
                    Target Airbase
                  </label>
                  <select
                    value={selectedWeatherAirbase}
                    onChange={(e) => setSelectedWeatherAirbase(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    {airbases.map((ab) => (
                      <option key={ab.id} value={ab.id}>
                        {ab.name} ({ab.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scenario Presets */}
                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">
                    Synthetic Hazard Scenario
                  </label>
                  <div className="space-y-1.5">
                    {[
                      {
                        type: 'THUNDERSTORM_SQUALL' as WeatherScenarioType,
                        label: 'Thunderstorm Squall',
                        desc: 'Convective microburst, severe turbulence, code 99',
                        icon: CloudLightning,
                      },
                      {
                        type: 'GALE_WINDS' as WeatherScenarioType,
                        label: 'Gale Crosswinds',
                        desc: '68 km/h sustained, 88 km/h gusts (takeoff limit)',
                        icon: Wind,
                      },
                      {
                        type: 'MONSOON_DOWNPOUR' as WeatherScenarioType,
                        label: 'Monsoon Downpour',
                        desc: '14.5 mm/h rain, standing water, hydroplaning',
                        icon: CloudRain,
                      },
                      {
                        type: 'DENSE_FOG' as WeatherScenarioType,
                        label: 'Dense Radiation Fog',
                        desc: '350m visibility, below CAT-I minimums',
                        icon: EyeOff,
                      },
                    ].map((s) => {
                      const Icon = s.icon;
                      const isSelected = selectedWeatherScenario === s.type;
                      return (
                        <div
                          key={s.type}
                          onClick={() => setSelectedWeatherScenario(s.type)}
                          className={`p-2 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/40 text-white'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                              <Icon className="w-3.5 h-3.5 text-sky-400" />
                              {s.label}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/30 text-sky-200 font-bold">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">{s.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {weatherNotice && (
                  <div className="p-1.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-200 text-[10px] text-center">
                    {weatherNotice}
                  </div>
                )}

                {/* Synthetic Notice */}
                <div className="text-[9px] text-slate-500 bg-slate-950/60 p-1.5 rounded border border-slate-800 text-center font-mono">
                  SYNTHETIC SIMULATION • REAL OPEN-METEO DATA PRESERVED
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleInjectWeather}
                    disabled={isWeatherInjecting}
                    className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-900/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isWeatherInjecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudLightning className="w-3.5 h-3.5" />
                    )}
                    Inject Hazard
                  </button>
                  <button
                    onClick={handleResetWeather}
                    disabled={isWeatherInjecting}
                    title="Clear synthetic overrides and restore actual Open-Meteo observations"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-slate-800 shrink-0 mx-0.5" />

        {/* 4. Autonomous 1-Click Demo */}
        {onAutoDemo && (
          <button
            onClick={onAutoDemo}
            disabled={isProcessing || isAutoRunning}
            title="Execute fully autonomous multi-stage operational scenario demonstration"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isAutoRunning
                ? 'bg-emerald-500 text-black animate-pulse'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] active:scale-95'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isAutoRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isAutoRunning ? 'DEMO RUNNING' : '1-CLICK DEMO'}</span>
          </button>
        )}

        {/* 5. Simulation Delta Results */}
        {onOpenScenarioComparison && (
          <button
            onClick={onOpenScenarioComparison}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
              hasActiveComparison
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Inspect side-by-side Before/After simulation comparison"
          >
            <GitCompare className="w-3.5 h-3.5 text-amber-400" />
            <span>DELTA</span>
          </button>
        )}

        {/* 6. Reset */}
        <button
          onClick={() => setShowResetConfirm(true)}
          disabled={isProcessing || isAutoRunning}
          title="Reset all aircraft, missions, airbases, and threat environment to default state"
          className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Reset</span>
        </button>

        {/* 7. Minimize */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0 ml-0.5"
          title="Minimize Scenario Injector"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Reset Confirmation Dialog Modal (Portaled to document.body to prevent transform clipping) */}
      {showResetConfirm &&
        createPortal(
          <div
            onClick={() => setShowResetConfirm(false)}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass-panel p-5 rounded-2xl border border-amber-500/50 shadow-2xl space-y-3 font-mono text-xs animate-in zoom-in-95 duration-150 bg-slate-950/95"
            >
              <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" />
                  Confirm Tactical Reset
                </span>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="text-slate-400 hover:text-white p-1 rounded cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-slate-200 text-xs font-sans leading-relaxed">
                Are you sure you want to restore all aircraft readiness, pilot duty logs, runways, and threat environments to default seeded baseline?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-md transition-colors"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
