import React, { useState, useMemo } from 'react';
import {
  Plane,
  Users,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Fuel,
  Search,
  X,
  Gauge,
  Crosshair,
  Award,
  Zap,
  CheckCircle2,
  SlidersHorizontal,
  Clock,
  ArrowRight,
  ChevronRight,
  RotateCcw,
  Activity,
  Layers,
  LifeBuoy,
  Wrench,
  Database,
  FileCheck,
  TrendingUp,
} from 'lucide-react';
import type {
  StateSnapshot,
  Aircraft,
  Pilot,
  Airbase,
} from '../types';
import { DataFusionPanel } from './DataFusionPanel';
import { MaintenanceLogisticsPanel } from './MaintenanceLogisticsPanel';
import { ApprovalsPanel } from './ApprovalsPanel';
import { HistoricalAnalyticsPanel } from './HistoricalAnalyticsPanel';

export type DashboardTabType =
  | 'AIRCRAFT'
  | 'PILOTS'
  | 'BASES'
  | 'MAINTENANCE'
  | 'DATA_FUSION'
  | 'APPROVALS'
  | 'ANALYTICS';

interface DashboardProps {
  state: StateSnapshot | null;
  initialTab?: DashboardTabType;
  onNavigateToMap?: () => void;
  onRefreshState?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  state,
  initialTab = 'AIRCRAFT',
  onNavigateToMap,
  onRefreshState,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTabType>(initialTab);

  // Synchronize activeTab when initialTab prop changes
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Search and Filter states
  const [aircraftSearch, setAircraftSearch] = useState('');
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState<'ALL' | 'COMBAT_JET' | 'ROTARY' | 'RESCUE_HELICOPTER' | 'TRANSPORT_HELICOPTER'>('ALL');
  const [aircraftModelFilter, setAircraftModelFilter] = useState('ALL');
  const [aircraftStatusFilter, setAircraftStatusFilter] = useState<string>('ALL');

  const [pilotSearch, setPilotSearch] = useState('');
  const [pilotStatusFilter, setPilotStatusFilter] = useState<string>('ALL');
  const [pilotQualFilter, setPilotQualFilter] = useState<string>('ALL');

  const [airbaseSearch, setAirbaseSearch] = useState('');
  const [airbaseStatusFilter, setAirbaseStatusFilter] = useState<string>('ALL');

  // Detail Modal / Drawer state
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [selectedPilot, setSelectedPilot] = useState<Pilot | null>(null);
  const [selectedAirbase, setSelectedAirbase] = useState<Airbase | null>(null);

  const aircraft = useMemo(() => {
    if (!state) return [];
    return state.aircraft_fleet || (state as any).aircraft || [];
  }, [state]);

  const pilots = useMemo(() => state?.pilots || [], [state]);
  const airbases = useMemo(() => state?.airbases || [], [state]);

  // KPI Calculations
  const readyJets = useMemo(() => aircraft.filter((a) => a.status === 'READY').length, [aircraft]);
  const airborneJets = useMemo(() => aircraft.filter((a) => a.status === 'AIRBORNE').length, [aircraft]);
  const maintJets = useMemo(() => aircraft.filter((a) => a.status === 'MAINTENANCE' || a.status === 'ABORTED').length, [aircraft]);
  const totalJets = aircraft.length;

  const combatJetsCount = useMemo(() => aircraft.filter((a) => !a.asset_type || a.asset_type === 'COMBAT_JET').length, [aircraft]);
  const rescueHelisCount = useMemo(() => aircraft.filter((a) => a.asset_type === 'RESCUE_HELICOPTER').length, [aircraft]);
  const transportHelisCount = useMemo(() => aircraft.filter((a) => a.asset_type === 'TRANSPORT_HELICOPTER').length, [aircraft]);
  const rotaryCount = rescueHelisCount + transportHelisCount;

  const restedPilots = useMemo(() => pilots.filter((p) => p.rest_hours_completed >= 8.0 && !p.assigned_aircraft_id).length, [pilots]);
  const airbornePilots = useMemo(() => pilots.filter((p) => !!p.assigned_aircraft_id).length, [pilots]);
  const fatiguedPilots = useMemo(() => pilots.filter((p) => p.rest_hours_completed < 8.0 && !p.assigned_aircraft_id).length, [pilots]);
  const totalPilots = pilots.length;

  const totalFuelLiters = useMemo(() => airbases.reduce((acc, b) => acc + b.available_fuel_liters, 0), [airbases]);
  const operationalBases = useMemo(() => airbases.filter((b) => b.runway_status === 'OPERATIONAL').length, [airbases]);

  // Filtered Aircraft
  const filteredAircraft = useMemo(() => {
    return aircraft.filter((ac) => {
      const matchesSearch =
        ac.callsign.toLowerCase().includes(aircraftSearch.toLowerCase()) ||
        ac.model.toLowerCase().includes(aircraftSearch.toLowerCase()) ||
        ac.aircraft_id.toLowerCase().includes(aircraftSearch.toLowerCase());

      const matchesType =
        aircraftTypeFilter === 'ALL' ||
        (aircraftTypeFilter === 'COMBAT_JET' && (!ac.asset_type || ac.asset_type === 'COMBAT_JET')) ||
        (aircraftTypeFilter === 'ROTARY' && (ac.asset_type === 'RESCUE_HELICOPTER' || ac.asset_type === 'TRANSPORT_HELICOPTER')) ||
        (ac.asset_type === aircraftTypeFilter);

      const matchesModel =
        aircraftModelFilter === 'ALL' || ac.model.toLowerCase().includes(aircraftModelFilter.toLowerCase());
      const matchesStatus =
        aircraftStatusFilter === 'ALL' || ac.status === aircraftStatusFilter;
      return matchesSearch && matchesType && matchesModel && matchesStatus;
    });
  }, [aircraft, aircraftSearch, aircraftTypeFilter, aircraftModelFilter, aircraftStatusFilter]);

  // Filtered Pilots
  const filteredPilots = useMemo(() => {
    return pilots.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(pilotSearch.toLowerCase()) ||
        p.rank.toLowerCase().includes(pilotSearch.toLowerCase()) ||
        p.pilot_id.toLowerCase().includes(pilotSearch.toLowerCase());
      const isRested = p.rest_hours_completed >= 8.0 && !p.assigned_aircraft_id;
      const isAirborne = !!p.assigned_aircraft_id;
      const isFatigued = p.rest_hours_completed < 8.0 && !p.assigned_aircraft_id;

      let matchesStatus = true;
      if (pilotStatusFilter === 'RESTED') matchesStatus = isRested;
      if (pilotStatusFilter === 'AIRBORNE') matchesStatus = isAirborne;
      if (pilotStatusFilter === 'FATIGUED') matchesStatus = isFatigued;

      const matchesQual =
        pilotQualFilter === 'ALL' || p.qualifications.includes(pilotQualFilter as any);

      return matchesSearch && matchesStatus && matchesQual;
    });
  }, [pilots, pilotSearch, pilotStatusFilter, pilotQualFilter]);

  // Filtered Airbases
  const filteredAirbases = useMemo(() => {
    return airbases.filter((base) => {
      const matchesSearch =
        base.name.toLowerCase().includes(airbaseSearch.toLowerCase()) ||
        base.id.toLowerCase().includes(airbaseSearch.toLowerCase());
      const matchesStatus =
        airbaseStatusFilter === 'ALL' || base.runway_status === airbaseStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [airbases, airbaseSearch, airbaseStatusFilter]);

  if (!state) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-950 text-slate-300 font-mono space-y-4">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm tracking-wider text-cyan-300">RECEIVING TACTICAL DATA STREAM...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-y-auto font-mono text-slate-100 select-none">
      {/* Top Banner & Header */}
      <div className="p-6 border-b border-cyan-500/20 bg-slate-900/40 shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent font-mono">
                TACTICAL ASSET & READINESS DASHBOARD
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider">
                SYNTHETIC DEMO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Comprehensive telemetry, operational statuses, qualifications, and logistics across all air wings.
            </p>
          </div>

          {onNavigateToMap && (
            <button
              onClick={onNavigateToMap}
              className="glass-panel px-4 py-2 rounded-xl text-xs font-mono text-cyan-300 border border-cyan-500/40 hover:border-cyan-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-md self-start md:self-auto"
            >
              <span>Back to Tactical Map</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 4 High-Level Readiness KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* 1. Fleet Readiness */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold uppercase">
                <Plane className="w-4 h-4 text-cyan-400" />
                Air Fleet & Rotary
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">
                {Math.round((readyJets / (totalJets || 1)) * 100)}% READY
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-100">{totalJets} Assets</span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-semibold">{readyJets} Rdy</span>
                <span className="text-cyan-400 font-semibold">{airborneJets} Air</span>
                <span className="text-rose-400 font-semibold">{maintJets} Maint</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between border-t border-slate-800/80 pt-1">
              <span>✈ {combatJetsCount} Jets</span>
              <span className="text-cyan-300 font-semibold">🚁 {rotaryCount} Helicopters (SAR/Transport)</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden flex">
              <div className="bg-emerald-400 h-full" style={{ width: `${(readyJets / totalJets) * 100}%` }} />
              <div className="bg-cyan-400 h-full" style={{ width: `${(airborneJets / totalJets) * 100}%` }} />
              <div className="bg-rose-500 h-full" style={{ width: `${(maintJets / totalJets) * 100}%` }} />
            </div>
          </div>

          {/* 2. Pilots Roster */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold uppercase">
                <Users className="w-4 h-4 text-cyan-400" />
                Pilot Wing
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">
                {Math.round((restedPilots / (totalPilots || 1)) * 100)}% RESTED
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-100">{totalPilots} Aviators</span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-semibold">{restedPilots} Rested</span>
                <span className="text-cyan-400 font-semibold">{airbornePilots} Air</span>
                <span className="text-amber-400 font-semibold">{fatiguedPilots} Fatigued</span>
              </div>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
              <div className="bg-emerald-400 h-full" style={{ width: `${(restedPilots / totalPilots) * 100}%` }} />
              <div className="bg-cyan-400 h-full" style={{ width: `${(airbornePilots / totalPilots) * 100}%` }} />
              <div className="bg-amber-400 h-full" style={{ width: `${(fatiguedPilots / totalPilots) * 100}%` }} />
            </div>
          </div>

          {/* 3. Base Runways */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold uppercase">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Airbases
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">
                {operationalBases}/{airbases.length} ACTIVE
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-100">{airbases.length} Bases</span>
              <span className="text-[11px] text-slate-300">
                {operationalBases === airbases.length ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All Operational
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {airbases.length - operationalBases} Runway Locked
                  </span>
                )}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full"
                style={{ width: `${(operationalBases / (airbases.length || 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* 4. Total Fuel Logistics */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold uppercase">
                <Fuel className="w-4 h-4 text-amber-400" />
                Fuel Logistics
              </span>
              <span className="text-amber-300 font-bold text-[11px]">THEATER RESERVE</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-300">
                {(totalFuelLiters / 1000000).toFixed(2)}M
                <span className="text-xs font-normal text-slate-400 ml-1">Liters</span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                Across {airbases.length} Forward Depots
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-400 h-full w-4/5" />
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('AIRCRAFT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'AIRCRAFT'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Air Fleet ({aircraft.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('PILOTS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'PILOTS'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Pilots ({pilots.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('BASES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'BASES'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Airbases ({airbases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('MAINTENANCE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'MAINTENANCE'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Maintenance & Logistics</span>
          </button>
          <button
            onClick={() => setActiveTab('DATA_FUSION')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'DATA_FUSION'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Data Fusion & Trust</span>
          </button>
          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'APPROVALS'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Approval Workflow</span>
          </button>
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${activeTab === 'ANALYTICS'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Historical Analytics & Forecast</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-6 space-y-4">
        {/* ─── TAB 1: AIRCRAFT / JETS / HELICOPTERS ───────────────────────────── */}
        {activeTab === 'AIRCRAFT' && (
          <div className="space-y-4">
            {/* Quick Filter Pill Buttons by Asset Class */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAircraftTypeFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${aircraftTypeFilter === 'ALL'
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
              >
                All Assets ({aircraft.length})
              </button>
              <button
                onClick={() => setAircraftTypeFilter('COMBAT_JET')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${aircraftTypeFilter === 'COMBAT_JET'
                    ? 'bg-sky-500/20 text-sky-200 border-sky-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <Plane className="w-3.5 h-3.5 text-sky-400" />
                <span>Combat Jets ({combatJetsCount})</span>
              </button>
              <button
                onClick={() => setAircraftTypeFilter('ROTARY')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${aircraftTypeFilter === 'ROTARY'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <span>🚁 All Rotary-Wing ({rotaryCount})</span>
              </button>
              <button
                onClick={() => setAircraftTypeFilter('RESCUE_HELICOPTER')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${aircraftTypeFilter === 'RESCUE_HELICOPTER'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>Rescue / CSAR ({rescueHelisCount})</span>
              </button>
              <button
                onClick={() => setAircraftTypeFilter('TRANSPORT_HELICOPTER')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${aircraftTypeFilter === 'TRANSPORT_HELICOPTER'
                    ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Heavy Transport ({transportHelisCount})</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search aircraft callsign, model, ID..."
                  value={aircraftSearch}
                  onChange={(e) => setAircraftSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Model Filter */}
                <select
                  value={aircraftModelFilter}
                  onChange={(e) => setAircraftModelFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Models</option>
                  <option value="Rafale">Rafale</option>
                  <option value="Su-30">Su-30 MKI</option>
                  <option value="Tejas">LCA Tejas</option>
                  <option value="Mirage">Mirage 2000</option>
                  <option value="Mi-17">Mi-17V5 SAR (CSAR)</option>
                  <option value="Chinook">CH-47F Chinook (Heavy)</option>
                  <option value="Prachand">HAL Prachand LCH</option>
                </select>

                {/* Status Filter */}
                <select
                  value={aircraftStatusFilter}
                  onChange={(e) => setAircraftStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="READY">READY</option>
                  <option value="AIRBORNE">AIRBORNE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="ABORTED">ABORTED</option>
                </select>

                {(aircraftSearch || aircraftTypeFilter !== 'ALL' || aircraftModelFilter !== 'ALL' || aircraftStatusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setAircraftSearch('');
                      setAircraftTypeFilter('ALL');
                      setAircraftModelFilter('ALL');
                      setAircraftStatusFilter('ALL');
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700"
                    title="Reset Filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Aircraft Cards Grid */}
            {filteredAircraft.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                No assets match your filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAircraft.map((ac) => {
                  const base = airbases.find((b) => b.id === ac.home_base_id);
                  const isReady = ac.status === 'READY';
                  const isAirborne = ac.status === 'AIRBORNE';
                  const isMaint = ac.status === 'MAINTENANCE';

                  const isRescue = ac.asset_type === 'RESCUE_HELICOPTER';
                  const isTransport = ac.asset_type === 'TRANSPORT_HELICOPTER';
                  const isRotary = isRescue || isTransport;

                  return (
                    <div
                      key={ac.aircraft_id}
                      onClick={() => setSelectedAircraft(ac)}
                      className="p-4 bg-slate-900/70 rounded-xl border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all cursor-pointer space-y-3 group shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-lg border transition-transform group-hover:scale-105 ${isRescue
                                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                                : isTransport
                                  ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                                  : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-400'
                              }`}
                          >
                            {isRescue ? (
                              <Activity className="w-4 h-4" />
                            ) : isTransport ? (
                              <Layers className="w-4 h-4" />
                            ) : (
                              <Plane className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 font-sans text-sm flex items-center gap-1.5">
                              {ac.callsign}
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span>{ac.model}</span>
                              <span>•</span>
                              <span className="text-cyan-300">{base?.name.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[9px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${isReady
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                : isAirborne
                                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 animate-pulse'
                                  : isMaint
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                    : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                              }`}
                          >
                            {ac.status}
                          </span>
                          {isRescue && (
                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                              🚁 CSAR / RESCUE
                            </span>
                          )}
                          {isTransport && (
                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                              🚁 HEAVY TRANSPORT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Technical Specs Grid */}
                      <div className="grid grid-cols-3 gap-2 text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block">FUEL PCT</span>
                          <span className="text-cyan-300 font-bold">{ac.current_fuel_pct}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">MAX RANGE</span>
                          <span className="text-slate-200 font-bold">{ac.max_range_km} km</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">SPEED</span>
                          <span className="text-slate-200 font-bold">{ac.cruise_speed_kmph} km/h</span>
                        </div>
                      </div>

                      {/* Munitions Loadout & Payload */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span>
                            {isRotary ? 'Mission Payload / Hardpoints:' : 'Hardpoints Equipped:'}
                          </span>
                          <span className="text-cyan-300 font-bold">
                            {ac.total_equipped_weapons_count} / {ac.hardpoints_count}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ac.equipped_weapons.length > 0 ? (
                            ac.equipped_weapons.map((eq, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
                              >
                                {eq.quantity}x {eq.weapon_id.replace('WEP_', '')}
                              </span>
                            ))
                          ) : isTransport ? (
                            <span className="text-[9px] text-indigo-300/80 font-medium">📦 Cargo / CASEVAC Cabin Configured</span>
                          ) : (
                            <span className="text-[9px] text-slate-500 italic">No munitions loaded</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: PILOTS ROSTER ────────────────────────────────────────── */}
        {activeTab === 'PILOTS' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search aviator name, rank, pilot ID..."
                  value={pilotSearch}
                  onChange={(e) => setPilotSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={pilotStatusFilter}
                  onChange={(e) => setPilotStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Readiness</option>
                  <option value="RESTED">RESTED (&gt;= 8h)</option>
                  <option value="AIRBORNE">AIRBORNE</option>
                  <option value="FATIGUED">FATIGUED (&lt; 8h)</option>
                </select>

                <select
                  value={pilotQualFilter}
                  onChange={(e) => setPilotQualFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Qualifications</option>
                  <option value="NIGHT_OPERATIONS">Night Operations</option>
                  <option value="DEAD_SEAD_CERTIFIED">DEAD / SEAD Certified</option>
                  <option value="ALL_WEATHER">All-Weather</option>
                  <option value="ANTI_SHIP_CERTIFIED">Anti-Ship Certified</option>
                </select>

                {(pilotSearch || pilotStatusFilter !== 'ALL' || pilotQualFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setPilotSearch('');
                      setPilotStatusFilter('ALL');
                      setPilotQualFilter('ALL');
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700"
                    title="Reset Filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Pilots Grid */}
            {filteredPilots.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                No pilots match your filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPilots.map((p) => {
                  const isRested = p.rest_hours_completed >= 8.0;
                  const isAssigned = !!p.assigned_aircraft_id;
                  const base = airbases.find((b) => b.id === p.home_base_id);

                  return (
                    <div
                      key={p.pilot_id}
                      onClick={() => setSelectedPilot(p)}
                      className="p-4 bg-slate-900/70 rounded-xl border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all cursor-pointer space-y-3 group shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 group-hover:scale-105 transition-transform">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 font-sans text-sm flex items-center gap-1.5">
                              {p.name}
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {p.rank} • <span className="text-cyan-300">{base?.name.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${isAssigned
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 animate-pulse'
                              : isRested
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                            }`}
                        >
                          {isAssigned ? 'AIRBORNE' : isRested ? 'RESTED' : 'FATIGUED'}
                        </span>
                      </div>

                      {/* Rest & Flight Hours Telemetry */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block">REST COMPLETED</span>
                          <span className={`font-bold ${isRested ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {p.rest_hours_completed}h / 8.0h
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">FLIGHT HOURS</span>
                          <span className="text-slate-200 font-bold">{p.consecutive_flight_hours}h consecutive</span>
                        </div>
                      </div>

                      {/* Qualifications */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block">Certifications:</span>
                        <div className="flex flex-wrap gap-1">
                          {p.qualifications.map((q, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-medium"
                            >
                              {q.replace('_CERTIFIED', '').replace('_OPERATIONS', '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: AIRBASES & DEPOTS ────────────────────────────────────── */}
        {activeTab === 'BASES' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search airbase name, location, ID..."
                  value={airbaseSearch}
                  onChange={(e) => setAirbaseSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={airbaseStatusFilter}
                  onChange={(e) => setAirbaseStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Runway Statuses</option>
                  <option value="OPERATIONAL">OPERATIONAL</option>
                  <option value="BLOCKED">BLOCKED / LOCKED OUT</option>
                </select>

                {(airbaseSearch || airbaseStatusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setAirbaseSearch('');
                      setAirbaseStatusFilter('ALL');
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700"
                    title="Reset Filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Airbases Grid */}
            {filteredAirbases.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                No airbases match your filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAirbases.map((base) => {
                  const isOp = base.runway_status === 'OPERATIONAL';
                  const stationedAc = aircraft.filter((a) => a.home_base_id === base.id);
                  const stationedPilots = pilots.filter((p) => p.home_base_id === base.id);

                  return (
                    <div
                      key={base.id}
                      onClick={() => setSelectedAirbase(base)}
                      className="p-4 bg-slate-900/70 rounded-xl border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all cursor-pointer space-y-3 group shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 font-sans text-sm flex items-center gap-1.5">
                              {base.name}
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              ID: <span className="text-cyan-300">{base.id}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${isOp
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse'
                            }`}
                        >
                          {base.runway_status}
                        </span>
                      </div>

                      {/* Telemetry Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block">FUEL RESERVES</span>
                          <span className="text-amber-300 font-bold">
                            {(base.available_fuel_liters / 1000).toLocaleString()}k L
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">COORDINATES</span>
                          <span className="text-slate-200 font-bold">
                            {base.lat.toFixed(2)}°N, {base.lng.toFixed(2)}°E
                          </span>
                        </div>
                      </div>

                      {/* Armory & Stored Weapons Summary */}
                      {(() => {
                        const stored = base.stored_weapons || [];
                        const totalStored = stored.reduce((acc, w) => acc + w.quantity, 0);

                        return (
                          <div className="space-y-1 pt-1 border-t border-slate-800/80">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-bold text-slate-300 flex items-center gap-1">
                                <Crosshair className="w-3 h-3 text-cyan-400" />
                                Armory Depot Stock:
                              </span>
                              <span className="text-emerald-300 font-bold">{totalStored} Munitions</span>
                            </div>
                            {stored.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {stored.slice(0, 4).map((w, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-cyan-200 border border-slate-800 font-mono"
                                  >
                                    {w.quantity}x {w.weapon_id.replace('WEP_', '')}
                                  </span>
                                ))}
                                {stored.length > 4 && (
                                  <span className="text-[9px] px-1 py-0.5 rounded text-slate-500">
                                    +{stored.length - 4} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-500 italic">No depot munitions stored</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Stationed Units */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Stationed:</span>
                        <div className="flex items-center gap-3">
                          <span className="text-cyan-300 font-bold">✈ {stationedAc.length} Jets</span>
                          <span className="text-indigo-300 font-bold">👤 {stationedPilots.length} Pilots</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: MAINTENANCE & LOGISTICS ──────────────────────────────── */}
        {activeTab === 'MAINTENANCE' && (
          <MaintenanceLogisticsPanel
            onRefreshState={onRefreshState}
            aircraftList={state?.aircraft_fleet || []}
            airbaseList={state?.airbases || []}
          />
        )}

        {/* ─── TAB 5: DATA FUSION & QUALITY ─────────────────────────────────── */}
        {activeTab === 'DATA_FUSION' && (
          <DataFusionPanel onRefreshState={onRefreshState} />
        )}

        {/* ─── TAB 6: APPROVAL WORKFLOW ─────────────────────────────────────── */}
        {activeTab === 'APPROVALS' && (
          <ApprovalsPanel onRefreshState={onRefreshState} />
        )}

        {/* ─── TAB 7: HISTORICAL ANALYTICS & FORECASTING ───────────────────── */}
        {activeTab === 'ANALYTICS' && (
          <HistoricalAnalyticsPanel />
        )}
      </div>

      {/* ─── MODAL: AIRCRAFT DETAILS ────────────────────────────────────────── */}
      {selectedAircraft && (() => {
        const isRescue = selectedAircraft.asset_type === 'RESCUE_HELICOPTER';
        const isTransport = selectedAircraft.asset_type === 'TRANSPORT_HELICOPTER';
        const isRotary = isRescue || isTransport;

        const assetTitle = isRescue
          ? 'Combat Search & Rescue (CSAR) Rotary-Wing'
          : isTransport
            ? 'Heavy Tactical Transport Rotary-Wing'
            : 'Multi-Role Strike Fighter Jet';

        const capabilities = isRescue
          ? ['Combat Search & Rescue (CSAR)', 'Downed Pilot Extraction', 'Armed Tactical Escort', 'CASEVAC']
          : isTransport
            ? ['Heavy Lift Logistics', 'Troop Air Assault', 'Forward Ammo & Fuel Transport', 'Tactical Evacuation']
            : ['Air Dominance', 'Precision Ground Strike', 'SEAD / DEAD Certified', 'Deep Penetration Interdiction'];

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg glass-panel p-5 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg border ${isRescue
                        ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                        : isTransport
                          ? 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300'
                          : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400'
                      }`}
                  >
                    {isRescue ? (
                      <Activity className="w-5 h-5" />
                    ) : isTransport ? (
                      <Layers className="w-5 h-5" />
                    ) : (
                      <Plane className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-100 font-sans">
                        {selectedAircraft.callsign} ({selectedAircraft.model})
                      </h3>
                      {isRotary && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                          ROTARY
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-cyan-300">{assetTitle} • ID: {selectedAircraft.aircraft_id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAircraft(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Classification & Role Banner */}
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Mission Capabilities & Role:</span>
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap, i) => (
                    <span
                      key={i}
                      className="text-[9px] px-2 py-0.5 rounded bg-slate-950 text-slate-200 border border-slate-700/80"
                    >
                      ✓ {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">OPERATIONAL STATUS</span>
                  <span className="font-bold text-emerald-400 text-sm">{selectedAircraft.status}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">HOME BASE</span>
                  <span className="font-bold text-cyan-300 text-sm">
                    {airbases.find((b) => b.id === selectedAircraft.home_base_id)?.name || selectedAircraft.home_base_id}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">FUEL TANK LEVEL</span>
                  <span className="font-bold text-amber-300 text-sm">
                    {selectedAircraft.current_fuel_pct}% ({selectedAircraft.current_fuel_liters}L / {selectedAircraft.max_fuel_capacity_liters}L)
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">MAX RANGE</span>
                  <span className="font-bold text-slate-200 text-sm">{selectedAircraft.max_range_km} km</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">CRUISE SPEED</span>
                  <span className="font-bold text-slate-200 text-sm">{selectedAircraft.cruise_speed_kmph} km/h</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">TURNAROUND TIME</span>
                  <span className="font-bold text-cyan-300 text-sm">{selectedAircraft.turnaround_time_mins} mins</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">MAX TAKEOFF WEIGHT</span>
                  <span className="font-bold text-slate-200 text-sm">{selectedAircraft.max_takeoff_weight_kg.toLocaleString()} kg</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">FUEL CONSUMPTION RATE</span>
                  <span className="font-bold text-slate-200 text-sm">{selectedAircraft.fuel_burn_liters_per_km} L / km</span>
                </div>
              </div>

              {/* Munitions Loadout */}
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
                <span className="text-slate-400 text-[11px] font-bold block">
                  {isRotary ? 'Configured Hardpoints & Mission Payload:' : `Hardpoint Armament (${selectedAircraft.total_equipped_weapons_count} / ${selectedAircraft.hardpoints_count} Equipped):`}
                </span>
                {selectedAircraft.equipped_weapons.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedAircraft.equipped_weapons.map((eq, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs bg-black/40 px-2.5 py-1.5 rounded border border-slate-800"
                      >
                        <span className="text-slate-200">{eq.weapon_id.replace('WEP_', '')}</span>
                        <span className="text-cyan-300 font-bold">{eq.quantity} units</span>
                      </div>
                    ))}
                  </div>
                ) : isTransport ? (
                  <div className="bg-black/40 p-2.5 rounded border border-slate-800 text-slate-300 space-y-1">
                    <span className="font-semibold text-indigo-300 block">📦 Heavy Cargo / Medevac Cabin Configuration</span>
                    <p className="text-[10px] text-slate-400">Equipped with internal cargo winches, stretchers, and auxiliary power units for casualty rescue.</p>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No munitions configured on hardpoints.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL: PILOT DOSSIER ───────────────────────────────────────────── */}
      {selectedPilot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-5 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-sans">{selectedPilot.name}</h3>
                  <p className="text-[10px] text-slate-400">{selectedPilot.rank} • ID: {selectedPilot.pilot_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPilot(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">DUTY STATUS</span>
                <span
                  className={`font-bold text-sm ${selectedPilot.assigned_aircraft_id
                      ? 'text-cyan-400'
                      : selectedPilot.rest_hours_completed >= 8.0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                >
                  {selectedPilot.assigned_aircraft_id
                    ? 'AIRBORNE'
                    : selectedPilot.rest_hours_completed >= 8.0
                      ? 'RESTED & READY'
                      : 'MANDATORY REST'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">HOME SQUADRON BASE</span>
                <span className="font-bold text-cyan-300 text-sm">
                  {airbases.find((b) => b.id === selectedPilot.home_base_id)?.name || selectedPilot.home_base_id}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">REST HOURS COMPLETED</span>
                <span
                  className={`font-bold text-sm ${selectedPilot.rest_hours_completed >= 8.0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                >
                  {selectedPilot.rest_hours_completed} hours
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">CONSECUTIVE FLIGHT</span>
                <span className="font-bold text-slate-200 text-sm">{selectedPilot.consecutive_flight_hours} hours</span>
              </div>
            </div>

            {selectedPilot.assigned_aircraft_id && (
              <div className="bg-cyan-950/40 p-2.5 rounded-lg border border-cyan-500/40 text-cyan-200">
                <span className="text-[10px] text-cyan-400 block font-bold">CURRENT ACTIVE SORTIE</span>
                <span>Assigned to Jet: <strong>{selectedPilot.assigned_aircraft_id}</strong></span>
              </div>
            )}

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="text-slate-400 text-[11px] font-bold block">Qualifications & Ratings:</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedPilot.qualifications.map((q, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2.5 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 font-semibold"
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: AIRBASE PROFILE & WEAPON INVENTORY ─────────────────────── */}
      {selectedAirbase && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl glass-panel p-5 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 font-sans">{selectedAirbase.name}</h3>
                  <p className="text-[10px] text-slate-400">Facility ID: {selectedAirbase.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAirbase(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">RUNWAY STATUS</span>
                <span
                  className={`font-bold text-sm ${selectedAirbase.runway_status === 'OPERATIONAL' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                >
                  {selectedAirbase.runway_status}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">FUEL RESERVE</span>
                <span className="font-bold text-amber-300 text-sm">
                  {selectedAirbase.available_fuel_liters.toLocaleString()} Liters
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">LATITUDE</span>
                <span className="font-bold text-slate-200 text-sm">{selectedAirbase.lat.toFixed(4)}°N</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">LONGITUDE</span>
                <span className="font-bold text-slate-200 text-sm">{selectedAirbase.lng.toFixed(4)}°E</span>
              </div>
            </div>

            {/* Mod 8: Stored Weapon Inventory Section */}
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-cyan-500/30 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-100 font-bold text-[12px] font-sans">
                    Armory & Stored Weapon Inventory
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 font-bold">
                  {(selectedAirbase.stored_weapons || []).reduce((acc, w) => acc + w.quantity, 0)} TOTAL STORED
                </span>
              </div>

              {(selectedAirbase.stored_weapons || []).length > 0 ? (
                <div className="space-y-1.5">
                  {selectedAirbase.stored_weapons?.map((item, i) => {
                    const wepMeta = state.weapons_inventory?.find((w) => w.weapon_id === item.weapon_id);
                    const category = wepMeta?.category || 'ORDNANCE';
                    const rangeKm = wepMeta?.effective_range_km || '—';
                    const guidance = wepMeta?.guidance_type || 'STANDARD';

                    return (
                      <div
                        key={i}
                        className="bg-black/50 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 text-xs truncate">
                            {wepMeta?.name || item.weapon_id.replace('WEP_', '')}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="text-cyan-300 font-semibold">{category}</span>
                            <span>•</span>
                            <span>Range: <strong className="text-slate-200">{rangeKm} km</strong></span>
                            <span>•</span>
                            <span>{guidance}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-emerald-400 block font-mono">
                            {item.quantity} units
                          </span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                            IN DEPOT
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs italic">
                  No munitions currently stored in forward armory depot for this facility.
                </div>
              )}
            </div>

            {/* Stationed Aircraft & Mounted Munitions */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="text-slate-400 text-[11px] font-bold block">
                Stationed Aircraft & Mounted Loadouts:
              </span>
              <div className="space-y-1.5">
                {aircraft
                  .filter((a) => a.home_base_id === selectedAirbase.id)
                  .map((a) => (
                    <div
                      key={a.aircraft_id}
                      className="bg-black/30 p-2 rounded border border-slate-800/80 flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-200 font-bold">
                        ✈ {a.callsign} <span className="text-slate-400 font-normal">({a.model})</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {a.equipped_weapons.map((w, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
                          >
                            {w.quantity}x {w.weapon_id.replace('WEP_', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
