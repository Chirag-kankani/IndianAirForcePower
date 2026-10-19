import React, { useState } from 'react';
import {
  Crosshair,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Send,
  ShieldCheck,
  Zap,
  Shield,
  Layers,
  Fuel,
  Clock,
  Navigation,
  Radio,
  Plane,
  Users,
  AlertTriangle,
  X,
  RotateCcw,
  SquareActivity,
  ScrollText,
  CloudRain,
  Wind,
  ChevronRight,
} from 'lucide-react';
import {
  MissionTarget,
  MissionPackage,
  PlanMissionResponse,
  TargetType,
  Location,
  ActiveMission,
  EventLogEntry,
  AirbaseWeatherData,
} from '../types';
import { fetchTheatreWeather } from '../services/api';

interface MissionCommandPanelProps {
  targets: MissionTarget[];
  selectedTargetId: string | null;
  customTargetLocation: Location | null;
  onSelectTargetId: (id: string) => void;
  planResult: PlanMissionResponse | null;
  isLoadingPlan: boolean;
  onGeneratePlan: (targetId?: string, customLoc?: Location, priority?: number) => void;
  selectedPackage: MissionPackage | null;
  onSelectPackage: (pkg: MissionPackage) => void;
  onDeployPackage: (packageId: string) => void;
  isDeploying: boolean;
  activeMissions?: ActiveMission[];
  selectedActiveMissionId?: string | null;
  onSelectActiveMissionId?: (id: string | null) => void;
  onCloseMission?: (missionId: string) => Promise<void>;
  isClosingMission?: boolean;
  eventLog?: EventLogEntry[];
  onClose?: () => void;
}

// Per-mission event type styling helpers
const EVENT_TYPE_META: Record<string, { label: string; className: string }> = {
  RUNWAY_BLOCKED: { label: 'RUNWAY BLOCKED', className: 'bg-amber-500/20 border-amber-500/50 text-amber-300' },
  NEW_THREAT_ZONE: { label: 'NEW THREAT', className: 'bg-rose-500/20 border-rose-500/50 text-rose-300' },
  AIRCRAFT_FAILURE: { label: 'AIRCRAFT FAULT', className: 'bg-red-600/20 border-red-500/50 text-red-300' },
  RESET: { label: 'RESET', className: 'bg-slate-700/60 border-slate-600/50 text-slate-400' },
};

export const MissionCommandPanel: React.FC<MissionCommandPanelProps> = ({
  targets,
  selectedTargetId,
  customTargetLocation,
  onSelectTargetId,
  planResult,
  isLoadingPlan,
  onGeneratePlan,
  selectedPackage,
  onSelectPackage,
  onDeployPackage,
  isDeploying,
  activeMissions = [],
  selectedActiveMissionId,
  onSelectActiveMissionId,
  onCloseMission,
  isClosingMission = false,
  eventLog = [],
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'PLANNING' | 'ACTIVE_SORTIES'>('PLANNING');
  const [priority, setPriority] = useState<number>(4);
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});
  const [expandedCostBreakdowns, setExpandedCostBreakdowns] = useState<Record<string, boolean>>({});
  const [missionToClose, setMissionToClose] = useState<ActiveMission | null>(null);
  const [weatherMap, setWeatherMap] = useState<Record<string, AirbaseWeatherData>>({});

  React.useEffect(() => {
    let isMounted = true;
    const loadWeather = async () => {
      try {
        const res = await fetchTheatreWeather(false);
        if (isMounted) {
          const map: Record<string, AirbaseWeatherData> = {};
          res.airbases.forEach((ab) => {
            map[ab.airbase_id] = ab;
          });
          setWeatherMap(map);
        }
      } catch {
        // Soft fallback
      }
    };
    loadWeather();
  }, [planResult]);

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleChecklist = (id: string) => {
    setExpandedChecklists((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCostBreakdown = (id: string) => {
    setExpandedCostBreakdowns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentTarget = targets.find((t) => t.target_id === selectedTargetId);

  // Synchronize optimizer priority with selected target's priority_level as single source of truth
  React.useEffect(() => {
    if (currentTarget) {
      setPriority(currentTarget.priority_level);
    }
  }, [currentTarget?.target_id, currentTarget?.priority_level]);

  // Auto-switch to Active Sorties tab if a new mission is deployed and selected
  React.useEffect(() => {
    if (activeMissions.length > 0 && selectedActiveMissionId) {
      setActiveTab('ACTIVE_SORTIES');
    }
  }, [selectedActiveMissionId, activeMissions.length]);

  return (
    <div className="w-full h-full flex flex-col glass-panel-floating rounded-2xl border border-sky-400/35 text-xs font-mono select-none overflow-hidden shadow-[0_16px_45px_-4px_rgba(2,132,199,0.35),0_0_24px_rgba(56,189,248,0.18)]">
      {/* Luminous Skyblue Accent Horizon Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-sky-400 via-sky-300 to-cyan-400 opacity-90 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />

      {/* Panel Top Navigation Tabs */}
      <div className="p-3 border-b border-sky-500/20 shrink-0 space-y-2 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-950/80 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.35)]">
              <Crosshair className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wider text-white font-sans flex items-center gap-1.5">
                <span>MISSION COMMAND</span>
                <span className="text-[10px] text-sky-300/80 font-mono font-normal">AIR-OPS</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
              {activeMissions.length} ACTIVE
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-sky-300 hover:text-white hover:bg-sky-500/25 transition-all cursor-pointer border border-sky-400/30 hover:border-sky-300"
                title="Collapse Command Panel"
              >
                <ChevronRight className="w-4 h-4 text-sky-400" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-sky-500/20">
          <button
            onClick={() => setActiveTab('PLANNING')}
            className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer ${
              activeTab === 'PLANNING'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Planning & Optimizer
          </button>
          <button
            onClick={() => setActiveTab('ACTIVE_SORTIES')}
            className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ACTIVE_SORTIES'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Active Sorties</span>
            {activeMissions.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {/* ─── TAB 1: PLANNING & OPTIMIZER ───────────────────────────────────── */}
      {activeTab === 'PLANNING' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Target Form */}
          <div className="p-3 border-b border-slate-800 shrink-0 space-y-2.5">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider flex justify-between">
                <span>Select Tactical Target</span>
                {customTargetLocation && (
                  <span className="text-cyan-400">Map Custom Grid</span>
                )}
              </label>
              <select
                value={selectedTargetId || ''}
                onChange={(e) => onSelectTargetId(e.target.value)}
                className="w-full bg-slate-900/90 border border-sky-500/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40"
              >
                <option value="" disabled>-- Select Strategic Target --</option>
                {targets.map((tgt) => (
                  <option key={tgt.target_id} value={tgt.target_id}>
                    {tgt.name} (P-{tgt.priority_level} • {tgt.target_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Details Badge */}
            {currentTarget && (
              <div className="bg-sky-950/30 p-2.5 rounded-lg border border-sky-500/25 text-[10px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Required Munition:</span>
                  <span className="text-sky-300 font-bold">{currentTarget.required_weapon_category}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pilot Qualification:</span>
                  <span className="text-emerald-400 font-bold">
                    {currentTarget.required_pilot_qualifications.join(', ') || 'STANDARD'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Strike Window:</span>
                  <span className="text-amber-400 font-bold">{currentTarget.time_window_mins} mins</span>
                </div>
              </div>
            )}

            {/* Priority Selector & Generate Button */}
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex-1 flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-sky-500/25">
                <span className="text-[10px] text-slate-400">Priority:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setPriority(lvl)}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${priority === lvl
                          ? 'bg-sky-500 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.55)] font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onGeneratePlan(selectedTargetId || undefined, customTargetLocation || undefined, priority)}
                disabled={isLoadingPlan || (!selectedTargetId && !customTargetLocation)}
                className="px-4 py-2 bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black rounded-lg transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(56,189,248,0.45)] hover:shadow-[0_0_30px_rgba(56,189,248,0.7)] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoadingPlan ? 'SOLVING...' : 'OPTIMIZE'}</span>
              </button>
            </div>
          </div>

          {/* Plan Results Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {!planResult && !isLoadingPlan && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Layers className="w-10 h-10 text-slate-700 animate-pulse" />
                <p className="text-xs text-slate-400 font-sans">
                  Select a target and click <strong>OPTIMIZE</strong> to compute constrained-optimal multi-role sortie packages.
                </p>
              </div>
            )}

            {isLoadingPlan && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-cyan-400">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <div className="text-xs font-mono">
                  Running Google OR-Tools CP-SAT integer optimization...
                </div>
                <div className="text-[10px] text-slate-500">
                  Evaluating MTOW, Hardpoints, Pilot Fatigue, Threat Vectors & Range
                </div>
              </div>
            )}

            {planResult && planResult.status === 'INFEASIBLE' && (
              <div className="p-3.5 bg-rose-950/40 rounded-lg border border-rose-500/40 text-rose-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>INFEASIBLE: NO VIABLE SORTIES FOUND</span>
                </div>
                <p className="text-[11px] text-slate-300">{planResult.message}</p>
                {planResult.infeasibility_summary?.rejection_reasons && (
                  <div className="bg-slate-950/60 p-2 rounded text-[10px] space-y-1">
                    <span className="text-slate-400 block font-bold">Constraint Rejection Counts:</span>
                    {Object.entries(planResult.infeasibility_summary.rejection_reasons).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-slate-400">
                        <span>{k.replace('C', '').replace(/_/g, ' ')}:</span>
                        <span className="text-rose-400 font-bold">{v} rejections</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {planResult && planResult.status === 'FEASIBLE' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Top Constrained Recommendations</span>
                  <span className="text-sky-300 font-semibold">{planResult.packages.length} Packages</span>
                </div>

                {planResult.packages.map((pkg) => {
                  const isSelected = selectedPackage?.package_id === pkg.package_id;
                  const isRecommended = pkg.rank === 1;

                  return (
                    <div
                      key={pkg.package_id}
                      onClick={() => onSelectPackage(pkg)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? 'bg-sky-950/45 border-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.3)] ring-1 ring-sky-400/50'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-sky-500/40 hover:bg-slate-900/85'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isRecommended
                                  ? 'bg-sky-500/25 border border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              RANK #{pkg.rank} {isRecommended && '★ RECOMMENDED'}
                            </span>
                            <span className="text-slate-400 text-[10px]">{pkg.package_id}</span>
                          </div>
                          <div className="font-bold text-sm text-slate-100 font-sans mt-1">
                            {pkg.aircraft.callsign} • {pkg.aircraft.model}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {pkg.pilot.name} ({pkg.pilot.rank}) • Base: {pkg.airbase.name.split(' ')[0]}
                          </div>
                        </div>

                        {/* Operation Cost & Composite Score */}
                        <div className="flex flex-col items-end">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-wider">
                              EST. OPERATION COST
                            </span>
                            <div className="flex items-baseline gap-1.5 justify-end">
                              <span className="text-base font-black text-emerald-400 font-sans">
                                ₹{(pkg.estimated_cost_lakhs ?? pkg.score_breakdown?.estimated_cost_lakhs ?? 8.5).toFixed(2)} L
                              </span>
                              <span className="text-[10px] text-cyan-300 font-mono" title="Tactical Cost Index Score">
                                (Score: {pkg.total_score.toFixed(2)})
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCostBreakdown(pkg.package_id);
                            }}
                            className="mt-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-200 underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>{expandedCostBreakdowns[pkg.package_id] ? '▲ Hide cost breakdown' : '▼ View cost breakdown'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Operation Cost Breakdown Section */}
                      {expandedCostBreakdowns[pkg.package_id] && pkg.score_breakdown && (() => {
                        const sb = pkg.score_breakdown;
                        const wFuel = 0.30;
                        const wThreat = 0.50;
                        const wTurn = 0.20;
                        const cFuel = wFuel * sb.fuel;
                        const cThreat = wThreat * sb.threat;
                        const cTurn = wTurn * sb.turnaround;
                        const pBonus = (sb.priority_bonus ?? 0);
                        const baseCost = sb.base_cost ?? 15.0;

                        // Fallback estimates if backend hasn't populated financial costs
                        const flightHours = (pkg.route.eta_mins * 2.0) / 60.0;
                        const fuelCostInr = sb.fuel_cost_inr ?? (pkg.route.fuel_needed_liters * 110.0);
                        const flightCostInr = sb.flight_hours_cost_inr ?? (flightHours * 320000.0);
                        const munitionsCostInr = sb.munitions_cost_inr ?? (pkg.ordnance_payload.length * 25000.0 || 40000.0);
                        const groundSupportInr = sb.ground_support_inr ?? (pkg.aircraft.turnaround_time_mins * 1000.0);
                        const totalCostInr = sb.total_estimated_cost_inr ?? (fuelCostInr + flightCostInr + munitionsCostInr + groundSupportInr);
                        const costInLakhs = sb.estimated_cost_lakhs ?? (totalCostInr / 100000.0);

                        let mainDriver = 'Fuel consumption & cruise range';
                        if (cThreat >= cFuel && cThreat >= cTurn) {
                          mainDriver = 'Threat radar exposure';
                        } else if (cTurn >= cFuel && cTurn >= cThreat) {
                          mainDriver = 'Turnaround cycle readiness';
                        }

                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-950/95 p-3 rounded-xl border border-cyan-500/30 text-[10px] font-mono space-y-2.5 text-slate-300 animate-in fade-in duration-150 shadow-xl"
                          >
                            {/* 1. Financial Sortie Cost Breakdown */}
                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-emerald-500/30 space-y-1.5">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <span>💰</span> ESTIMATED SORTIE FINANCIAL COST
                                </span>
                                <span className="text-emerald-300 font-black text-xs">
                                  ₹{costInLakhs.toFixed(2)} Lakhs
                                </span>
                              </div>

                              <div className="space-y-1 pt-1 text-[9px]">
                                <div className="flex justify-between text-slate-300">
                                  <span className="text-slate-400">1. ATF Fuel Burn ({pkg.route.fuel_needed_liters.toLocaleString()} L @ ₹110/L):</span>
                                  <span className="text-slate-200 font-semibold font-mono">₹{Math.round(fuelCostInr).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span className="text-slate-400">2. Airframe & Engine Flight Hours ({flightHours.toFixed(1)}h R/T @ CPFH):</span>
                                  <span className="text-slate-200 font-semibold font-mono">₹{Math.round(flightCostInr).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span className="text-slate-400">3. Munitions Allocation & Ordnance Prep:</span>
                                  <span className="text-slate-200 font-semibold font-mono">₹{Math.round(munitionsCostInr).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span className="text-slate-400">4. Ground Servicing & Turnaround ({pkg.aircraft.turnaround_time_mins} mins):</span>
                                  <span className="text-slate-200 font-semibold font-mono">₹{Math.round(groundSupportInr).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800 font-bold">
                                  <span>Total Operational Cost:</span>
                                  <span className="font-mono">₹{Math.round(totalCostInr).toLocaleString('en-IN')} (₹{costInLakhs.toFixed(2)} L)</span>
                                </div>
                              </div>
                            </div>

                            {/* 2. Tactical Optimizer Index */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-cyan-300 font-bold">
                                <span>TACTICAL COMPOSITE COST INDEX</span>
                                <span className="text-[9px] text-slate-400">Score: {pkg.total_score.toFixed(2)}</span>
                              </div>

                              <div className="text-[9px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                                <code>Cost = 15.0(Base) + 0.30×Fuel + 0.50×Threat + 0.20×Turnaround − Priority</code>
                              </div>

                              <div className="space-y-1.5 pt-0.5">
                                <div>
                                  <div className="flex justify-between text-slate-300 mb-0.5">
                                    <span>1. Fuel Burn ({sb.fuel.toFixed(1)}% tank capacity, 30% weight)</span>
                                    <span className="text-cyan-300 font-semibold">+{cFuel.toFixed(2)}</span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                                    <div className="bg-cyan-400 h-full" style={{ width: `${Math.min(sb.fuel, 100)}%` }} />
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-slate-300 mb-0.5">
                                    <span>2. Threat Risk Exposure (50% weight)</span>
                                    <span className="text-rose-300 font-semibold">+{cThreat.toFixed(2)}</span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                                    <div className="bg-rose-400 h-full" style={{ width: `${Math.min(sb.threat, 100)}%` }} />
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-slate-300 mb-0.5">
                                    <span>3. Turnaround Readiness (20% weight)</span>
                                    <span className="text-amber-300 font-semibold">+{cTurn.toFixed(2)}</span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                                    <div className="bg-amber-400 h-full" style={{ width: `${Math.min(sb.turnaround, 100)}%` }} />
                                  </div>
                                </div>

                                {pBonus > 0 && (
                                  <div className="flex justify-between text-emerald-400 pt-0.5 border-t border-slate-800/80">
                                    <span>4. Target Priority Discount Incentive</span>
                                    <span className="font-bold">−{pBonus.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-800 flex items-start gap-1">
                                <span className="text-cyan-400 font-bold">Driver:</span>
                                <span>
                                  Primary cost driver is <strong className="text-slate-200">{mainDriver}</strong>. Lower composite cost indicates higher operational suitability.
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Route & ETA Telemetry */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2 rounded-lg text-[10px] text-slate-400 border border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <Fuel className="w-3 h-3 text-cyan-400" />
                          <div>
                            <span className="text-slate-500 block">FUEL</span>
                            <span className="text-slate-200 font-bold">{pkg.route.fuel_needed_liters.toLocaleString()} L</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <div>
                            <span className="text-slate-500 block">ETA</span>
                            <span className="text-slate-200 font-bold">{pkg.route.eta_mins} mins</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Navigation className="w-3 h-3 text-emerald-400" />
                          <div>
                            <span className="text-slate-500 block">DISTANCE</span>
                            <span className="text-slate-200 font-bold">{pkg.route.distance_km} km</span>
                          </div>
                        </div>
                      </div>

                      {/* Weather Impact & Environmental Risk Advisory Panel */}
                      {(() => {
                        const abWeather = weatherMap[pkg.airbase.id];
                        if (!abWeather?.current) return null;
                        const risk = abWeather.risk_assessment?.overall_risk || 'LOW';
                        const isHigh = risk === 'HIGH';
                        const isMod = risk === 'MODERATE';

                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`p-2.5 rounded-lg border text-[10px] font-mono space-y-1.5 ${isHigh
                                ? 'bg-red-950/30 border-red-500/40 text-red-200'
                                : isMod
                                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5 text-sky-300">
                                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                                Base Weather Impact ({pkg.airbase.name.split(' ')[0]})
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded font-bold text-[9px] ${isHigh
                                    ? 'bg-red-500/30 text-red-300 border border-red-500/50 animate-pulse'
                                    : isMod
                                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  }`}
                              >
                                {risk} RISK
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-400 text-[10px] pt-1 border-t border-slate-800/60">
                              <span>
                                Temp: <strong className="text-white">{abWeather.current.temperature_c.toFixed(0)}°C</strong> • Wind: <strong className="text-white">{abWeather.current.wind_speed_kmh.toFixed(0)} km/h</strong>
                              </span>
                              <span>
                                Gusts: <strong className={isHigh ? 'text-red-400' : 'text-slate-200'}>{abWeather.current.wind_gusts_kmh.toFixed(0)} km/h</strong>
                              </span>
                            </div>

                            {abWeather.risk_assessment?.contributing_factors?.length > 0 ? (
                              <div className="text-[9px] text-amber-300 pt-0.5">
                                ⚠️ {abWeather.risk_assessment.contributing_factors[0].factor}: {abWeather.risk_assessment.contributing_factors[0].explanation}
                              </div>
                            ) : (
                              <div className="text-[9px] text-emerald-400/90 pt-0.5">
                                ✓ Meteorological envelope nominal for takeoff & recovery.
                              </div>
                            )}

                            <div className="text-[8px] text-slate-500 italic">
                              ADVISORY: Numerical model evaluation. Formal sortie release requires certified ATC/METAR.
                            </div>
                          </div>
                        );
                      })()}

                      {/* Deploy Action */}
                      {isSelected && (
                        <div className="pt-2 border-t border-slate-800 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeployPackage(pkg.package_id);
                            }}
                            disabled={isDeploying}
                            className="w-full py-2.5 bg-gradient-to-r from-sky-400 via-sky-500 to-emerald-500 hover:brightness-110 active:scale-98 text-slate-950 font-black rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(56,189,248,0.45)] cursor-pointer"
                          >
                            <Send className="w-4 h-4 fill-current" />
                            <span>{isDeploying ? 'DEPLOYING SORTIE...' : 'DEPLOY MISSION PACKAGE'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: ACTIVE SORTIES & CLOSE MISSION ──────────────────────────── */}
      {activeTab === 'ACTIVE_SORTIES' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {activeMissions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <SquareActivity className="w-10 h-10 text-slate-700 animate-pulse" />
              <div className="text-xs text-slate-300 font-bold">NO ACTIVE MISSIONS IN FLIGHT</div>
              <p className="text-[11px] text-slate-400 font-sans max-w-xs">
                To launch a sortie, switch to the <strong>Planning</strong> tab, select a strategic target, and click <strong>DEPLOY</strong>.
              </p>
              <button
                onClick={() => setActiveTab('PLANNING')}
                className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold cursor-pointer hover:bg-cyan-500/30"
              >
                Go to Planning Tab
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>In-Flight Tactical Sorties</span>
                <span className="text-cyan-300 font-bold">{activeMissions.length} Deployed</span>
              </div>

              {activeMissions.map((msn) => {
                const isSelected = selectedActiveMissionId === msn.mission_id;
                const isRerouted = msn.status === 'REROUTED';

                return (
                  <div
                    key={msn.mission_id}
                    onClick={() => onSelectActiveMissionId && onSelectActiveMissionId(isSelected ? null : msn.mission_id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-3 ${isSelected
                        ? 'bg-slate-900/95 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/60'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-cyan-300 font-sans">
                            {msn.mission_id}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${isRerouted
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                                : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                              }`}
                          >
                            {msn.status}
                          </span>
                        </div>
                        <div className="font-bold text-slate-100 font-sans mt-0.5">
                          ✈ {msn.aircraft.callsign} ({msn.aircraft.model})
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Pilot: <strong className="text-slate-200">{msn.pilot.name}</strong> • Base: {msn.airbase.name.split(' ')[0]}
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-slate-400">
                        <span>ETA:</span>
                        <div className="text-sm font-bold text-amber-300 font-sans">{msn.route.eta_mins} mins</div>
                      </div>
                    </div>

                    {/* Telemetry Summary */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-500 block">TARGET</span>
                        <span className="text-slate-200 font-bold">{msn.target.name.split(' ')[0]}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">DISTANCE</span>
                        <span className="text-cyan-300 font-bold">{msn.route.distance_km} km</span>
                      </div>
                    </div>

                    {/* Detour Note if present */}
                    {msn.route.detour_notes && (
                      <div className="bg-amber-500/10 p-2 rounded border border-amber-500/30 text-[10px] text-amber-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{msn.route.detour_notes}</span>
                      </div>
                    )}

                    {/* Detailed Expanded Dossier */}
                    {isSelected && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                        {/* Munitions Loadout */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 block font-bold">Ordnance Payload:</span>
                          <div className="flex flex-wrap gap-1">
                            {msn.ordnance_payload.map((eq, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700"
                              >
                                {eq.qty}x {eq.name} ({eq.weight_kg}kg)
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Waypoints sequence */}
                        <div className="text-[10px] text-slate-400 space-y-1 bg-black/40 p-2 rounded border border-slate-800">
                          <span className="font-bold text-slate-300 block">Flight Waypoints ({msn.route.waypoints.length}):</span>
                          <div className="flex items-center gap-1 overflow-x-auto text-[9px] text-slate-300 pb-1">
                            {msn.route.waypoints.map((wp, i) => (
                              <React.Fragment key={i}>
                                <span className={`px-1.5 py-0.5 rounded ${wp.action === 'ENGAGE' ? 'bg-red-500/20 text-red-300 border border-red-500/40 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                                  {wp.name}
                                </span>
                                {i < msn.route.waypoints.length - 1 && <span>➔</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* ── Per-Mission Event Timeline ─────────────────── */}
                        {(() => {
                          const msnEvents = eventLog.filter((ev) =>
                            ev.retasking_actions?.some((a) => a.mission_id === msn.mission_id)
                          );
                          const meta = (type: string) =>
                            EVENT_TYPE_META[type] ?? { label: type, className: 'bg-slate-700/60 border-slate-600/50 text-slate-400' };

                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <ScrollText className="w-3 h-3 text-slate-500" />
                                <span>Mission Event Log</span>
                                {msnEvents.length > 0 && (
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">
                                    {msnEvents.length} event{msnEvents.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>

                              {msnEvents.length === 0 ? (
                                <div className="bg-slate-950/60 rounded-lg border border-slate-800 p-2 text-[10px] text-slate-500 italic text-center">
                                  No events have affected this mission yet.
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                                  {msnEvents.map((ev) => {
                                    const m = meta(ev.event_type);
                                    const matchingActions = ev.retasking_actions.filter(
                                      (a) => a.mission_id === msn.mission_id
                                    );
                                    return (
                                      <div
                                        key={ev.event_id}
                                        className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 space-y-1 animate-in fade-in duration-150"
                                      >
                                        {/* Event header row */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${m.className}`}>
                                            {m.label}
                                          </span>
                                          <span className="text-[9px] text-slate-500 ml-auto font-mono">
                                            {new Date(ev.timestamp).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              second: '2-digit',
                                            })}
                                          </span>
                                        </div>

                                        {/* Event description */}
                                        <p className="text-[10px] text-slate-300 leading-relaxed">{ev.description}</p>

                                        {/* Retasking actions for this mission */}
                                        {matchingActions.length > 0 && (
                                          <div className="space-y-0.5 pt-0.5 border-t border-slate-800/80">
                                            {matchingActions.map((action, ai) => (
                                              <div
                                                key={ai}
                                                className="flex items-start gap-1.5 text-[9px] text-slate-400"
                                              >
                                                <span className="text-cyan-400 font-bold shrink-0">↳</span>
                                                <span>
                                                  <strong className="text-slate-300">{action.action_type}:</strong>{' '}
                                                  {action.reason}
                                                  {action.details ? ` — ${action.details}` : ''}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Close / End Mission Action Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMissionToClose(msn);
                            }}
                            disabled={isClosingMission}
                            className="w-full py-2 bg-rose-500/15 hover:bg-rose-500/30 active:scale-98 border border-rose-500/50 text-rose-300 hover:text-rose-100 font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                          >
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>End / Close Mission</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── CONFIRMATION MODAL: CLOSE MISSION ──────────────────────────────── */}
      {missionToClose && (
        <div className="fixed inset-0 z-[600] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-5 rounded-2xl border border-rose-500/50 shadow-2xl space-y-3 font-mono text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-rose-400 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Confirm Mission Closure
              </span>
              <button
                onClick={() => setMissionToClose(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-200 text-xs font-sans leading-relaxed">
              Are you sure you want to close and end active sortie <strong className="text-white">{missionToClose.mission_id}</strong>?
            </p>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div>✈ Aircraft <strong className="text-cyan-300">{missionToClose.aircraft.callsign}</strong> will be released back to <span className="text-emerald-400 font-bold">READY</span> status.</div>
              <div>👤 Pilot <strong className="text-slate-100">{missionToClose.pilot.name}</strong> will conclude flight duty and return to roster.</div>
              <div>🏢 Assets recovered to <strong className="text-amber-300">{missionToClose.airbase.name}</strong>.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setMissionToClose(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const msnId = missionToClose.mission_id;
                  setMissionToClose(null);
                  if (onCloseMission) {
                    await onCloseMission(msnId);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & End Mission</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
