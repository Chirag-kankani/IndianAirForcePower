import React from 'react';
import {
  Shield,
  ShieldAlert,
  Plane,
  Crosshair,
  Cpu,
  ArrowRight,
  Clock,
  Compass,
  FileCheck,
  Zap,
  Map as MapIcon,
  Satellite,
  BarChart3,
  Users,
  Fuel,
  RefreshCw,
  Database,
  Navigation,
  LayoutDashboard,
  History,
  Wrench,
  RotateCcw,
  CloudRain,
  Radio,
  Bot,
} from 'lucide-react';
import type { StateSnapshot } from '../types';
import { IAFEmblem } from './IAFEmblem';

interface LandingPageProps {
  state: StateSnapshot | null;
  onLaunchDashboard: (view?: 'MAP' | 'DASHBOARD' | 'DATA_FUSION' | 'MAINTENANCE' | 'REPLAY' | 'AUDIT' | 'WEATHER' | 'ASSISTANT') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ state, onLaunchDashboard }) => {
  // Real metrics from state or graceful defaults
  const readyAircraftCount =
    state?.aircraft_fleet.filter((a) => a.status === 'READY').length ?? 13;
  const totalAircraftCount = state?.aircraft_fleet.length ?? 15;
  const restedPilotsCount =
    state?.pilots.filter((p) => p.rest_hours_completed >= 8.0).length ?? 17;
  const totalPilotsCount = state?.pilots.length ?? 20;
  const operationalBasesCount =
    state?.airbases.filter((b) => b.runway_status === 'OPERATIONAL').length ?? 3;
  const totalBasesCount = state?.airbases.length ?? 3;

  return (
    <div className="relative min-h-screen w-full bg-[#050B16] text-slate-100 flex flex-col font-sans selection:bg-[#FF9933]/30 selection:text-amber-200 overflow-x-hidden">
      {/* --------------------------------------------------------------------- */}
      {/* 1. CINEMATIC SINGLE-VIEW HERO (100vh / Fit on Screen Without Scroll) */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative h-screen max-h-[100vh] min-h-[580px] w-full flex flex-col justify-between overflow-hidden select-none">
        {/* High-Resolution Satellite Image Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transform scale-[1.02] transition-transform duration-1000 opacity-25"
          style={{ backgroundImage: `url('/satellite-hero.jpg')` }}
        />

        {/* Indian Air Force Ambient Gradients & Subtle Mesh */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050B16]/90 via-[#071329]/80 to-[#050B16] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,153,51,0.15)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(19,136,8,0.12)_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0%,transparent_65%)] pointer-events-none animate-ambient-glow" />

        {/* Subtle Radar Grid Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:48px_48px] opacity-[0.06] pointer-events-none" />

        {/* ------------------------------------------------------------------- */}
        {/* Top Header Bar: Floating Left Brand Pill & Floating Navigation      */}
        {/* ------------------------------------------------------------------- */}
        <header className="relative z-30 w-full px-4 sm:px-6 lg:px-10 pt-3 sm:pt-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Floating Top-Left Brand Pill with IAF Roundel */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass-panel border border-slate-700/80 shadow-[0_4px_24px_rgba(0,0,0,0.6)] hover:border-amber-400/50 transition-all">
            {/* IAF Roundel SVG */}
            <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center shadow-[0_0_12px_rgba(255,153,51,0.4)]">
              <svg viewBox="0 0 100 100" className="w-6 h-6">
                <circle cx="50" cy="50" r="48" fill="#FF9933" />
                <circle cx="50" cy="50" r="32" fill="#FFFFFF" />
                <circle cx="50" cy="50" r="16" fill="#138808" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-extrabold tracking-wider font-mono text-white flex items-center gap-1">
                  <span className="text-[#FF9933]">BHARATIYA</span>
                  <span>VAYU</span>
                  <span className="text-[#10B981]">SENA</span>
                </span>
                <span className="text-[9px] text-slate-400 font-sans tracking-tight">INDIAN AIR FORCE • TACTICAL</span>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                OPERATIONS
              </span>
            </div>
          </div>

          {/* Floating Navigation Pill */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="inline-flex items-center glass-panel p-1 rounded-full border border-slate-800/90 shadow-xl overflow-x-auto">
              <button
                onClick={() => onLaunchDashboard('MAP')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-[#FF9933]/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Tactical Satellite Map"
              >
                <MapIcon className="w-3.5 h-3.5 text-[#FF9933]" />
                <span>TACTICAL MAP</span>
              </button>

              <button
                onClick={() => onLaunchDashboard('DASHBOARD')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Force Readiness Dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>DASHBOARD</span>
              </button>

              <button
                onClick={() => onLaunchDashboard('WEATHER')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Meteorology & Environmental Risk"
              >
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                <span>WEATHER</span>
              </button>

              <button
                onClick={() => onLaunchDashboard('DATA_FUSION')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Sensor Data Fusion & Trust Centre"
              >
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden xl:inline">DATA FUSION</span>
              </button>

              <button
                onClick={() => onLaunchDashboard('MAINTENANCE')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Maintenance & Logistics Centre"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">MRO</span>
              </button>

              <button
                onClick={() => onLaunchDashboard('REPLAY')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Scenario Event Replay & Debrief"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>REPLAY</span>
              </button>

              <button
                onClick={() => onLaunchDashboard('AUDIT')}
                className="px-3 py-1 rounded-full text-slate-300 hover:text-white hover:bg-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                title="Open Tactical Event Audit Log"
              >
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>AUDIT</span>
              </button>

              {/* Chatbot Button in Landing Top Nav */}
              <button
                onClick={() => onLaunchDashboard('ASSISTANT')}
                className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-bold border border-amber-500/40 shadow-[0_0_10px_rgba(255,153,51,0.25)]"
                title="Open Tactical Operations Assistant Chatbot"
              >
                <Bot className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>CHATBOT</span>
              </button>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------- */}
        {/* Central Hero Content with ANIMATED INDIAN AIR FORCE EMBLEM          */}
        {/* Compact sizing guarantees 100% single-view visibility without scroll */}
        {/* ------------------------------------------------------------------- */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto my-auto py-2 sm:py-3 animate-hero-fade">
          
          {/* THE OFFICIAL INDIAN AIR FORCE SYMBOL WITH ANIMATION EFFECT */}
          <div className="mb-2 sm:mb-3 transform hover:scale-105 transition-transform duration-500">
            <IAFEmblem size="md" withPulsingRadar={true} showMotto={false} />
          </div>

          {/* Eyebrow Pill with Tricolor Indicator */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-panel border border-amber-500/30 text-amber-200 text-xs font-mono tracking-wider shadow-inner mb-2">
            <span className="w-2 h-2 rounded-full bg-[#FF9933] shadow-[0_0_8px_rgba(255,153,51,0.9)] animate-pulse" />
            <span className="uppercase font-semibold">
              BHARATIYA VAYU SENA • AIR DEFENCE OPERATIONS
            </span>
            <span className="text-[#10B981] font-bold">SOVEREIGN AIRSPACE</span>
          </div>

          {/* Sanskrit Motto Banner */}
          <div className="text-sm sm:text-base md:text-lg font-serif text-amber-300/95 tracking-widest mb-1.5 font-bold drop-shadow-[0_2px_10px_rgba(255,153,51,0.3)]">
            नभः स्पृशं दीप्तम् • TOUCH THE SKY WITH GLORY
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white mb-2">
            <span>Supreme In The Skies.</span>
            <br />
            <span className="bg-gradient-to-r from-[#FF9933] via-slate-100 to-[#10B981] bg-clip-text text-transparent">
              Precision Air Operations.
            </span>
          </h1>

          {/* Supporting Description */}
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-slate-300 font-normal leading-relaxed max-w-[720px] mx-auto text-balance">
            Coordinating multi-role fighter squadrons (Rafale, Su-30MKI, Tejas LCA, Mirage 2000), 
            rotary search & rescue wings, runway readiness, and Google OR-Tools CP-SAT multi-objective sortie optimization.
          </p>

          {/* Clean Tactical Call-to-Action Buttons - VISIBLE IN SINGLE VIEW */}
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onLaunchDashboard('MAP')}
              className="group relative inline-flex items-center gap-2.5 px-6 sm:px-8 py-3 rounded-full bg-gradient-to-r from-[#FF9933] via-amber-500 to-[#E67E22] hover:brightness-110 text-slate-950 font-bold text-sm sm:text-base tracking-wide shadow-[0_0_30px_rgba(255,153,51,0.45)] hover:shadow-[0_0_45px_rgba(255,153,51,0.7)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer border border-amber-200/50"
            >
              <Navigation className="w-4 h-4 text-slate-950 transform -rotate-45 group-hover:scale-110 transition-transform" />
              <span>Launch Tactical Air Picture</span>
              <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onLaunchDashboard('ASSISTANT')}
              className="group relative inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-full bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 text-amber-200 hover:text-white font-semibold text-sm sm:text-base tracking-wide border border-amber-400/50 hover:border-amber-300 shadow-[0_0_20px_rgba(255,153,51,0.2)] hover:shadow-[0_0_30px_rgba(255,153,51,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer"
            >
              <Bot className="w-4 h-4 text-amber-400 group-hover:scale-110 animate-pulse transition-transform" />
              <span>Tactical Operations Chatbot</span>
            </button>

            <button
              onClick={() => onLaunchDashboard('DASHBOARD')}
              className="group relative inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-full glass-panel hover:bg-slate-800/80 text-emerald-300 hover:text-white font-semibold text-sm sm:text-base tracking-wide border border-emerald-500/40 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Squadron Fleet Matrix</span>
            </button>
          </div>
        </div>

        {/* Bottom subtle indicator */}
        <div className="shrink-0 flex justify-center pb-2 opacity-60">
          <div className="text-[10px] font-mono tracking-widest text-slate-400 flex items-center gap-1.5">
            <span>SCROLL FOR CAPABILITIES & SQUADRON TELEMETRY</span>
            <span>↓</span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 2. OPERATIONAL TELEMETRY TICKERS SECTION                              */}
      {/* --------------------------------------------------------------------- */}
      <section id="telemetry-overview" className="py-12 px-4 lg:px-8 border-y border-slate-800/80 bg-slate-950/60 relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] iaf-tricolor-gradient opacity-70" />
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-5 font-mono">
            <div className="glass-panel glass-panel-interactive p-4 rounded-2xl border border-sky-500/20 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>IAF COMBAT FLEET</span>
                <Plane className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {readyAircraftCount}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {totalAircraftCount} Aircraft</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-medium mt-1">
                ✓ Multi-role combat ready
              </div>
            </div>

            <div className="glass-panel glass-panel-interactive p-4 rounded-2xl border border-emerald-500/20 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>PILOT REST COMPLIANCE</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {restedPilotsCount}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {totalPilotsCount} Pilots</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-medium mt-1">
                ✓ ≥ 8.0h Mandatory Rest Enforced
              </div>
            </div>

            <div className="glass-panel glass-panel-interactive p-4 rounded-2xl border border-amber-500/20 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>FORWARD AIR BASES</span>
                <Fuel className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {operationalBasesCount}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {totalBasesCount} Bases</span>
              </div>
              <div className="text-[10px] text-amber-300 font-medium mt-1">
                Trishul • Garuda • Vayu Base
              </div>
            </div>

            <div className="glass-panel glass-panel-interactive p-4 rounded-2xl border border-sky-500/20 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>CP-SAT SOLVER SPEED</span>
                <Cpu className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                &lt; 50ms{' '}
                <span className="text-xs text-slate-400 font-normal">Latency</span>
              </div>
              <div className="text-[10px] text-sky-300 font-medium mt-1">
                Google OR-Tools Mathematical Solver
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 3. KEY CAPABILITIES SECTION                                           */}
      {/* --------------------------------------------------------------------- */}
      <section id="capabilities" className="py-20 px-4 lg:px-8 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md glass-panel border border-[#FF9933]/30 text-amber-300 font-mono text-xs font-semibold tracking-wider mb-3">
              <Zap className="w-3.5 h-3.5 text-[#FF9933]" />
              <span>IAF CORE ARCHITECTURAL MODULES</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Mission-Critical Command Capabilities
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Engineered for high-tempo air command environments where every variable—from
              pilot fatigue and weapon stock to runway integrity and pop-up SAM radars—must be
              mathematically accounted for.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Capability 1 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-sky-500/20 hover:border-sky-400/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all">
                    <Satellite className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-600/40 font-semibold">
                    ACTIVE OPERATIONS
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                  Unified Operational Air Picture
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  High-contrast satellite geospatial command map with Esri World Imagery,
                  live Indian airbases, dynamic threat radar perimeters (SAM batteries & EW corridors),
                  and animated flight vectors with real-time waypoint progression.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Esri Satellite + Dark Matter</span>
                <button
                  onClick={() => onLaunchDashboard('MAP')}
                  className="text-sky-400 hover:text-white transition-colors cursor-pointer font-bold"
                >
                  Explore Map →
                </button>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/40 font-semibold">
                    SOLVER ENGINE
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Multi-Objective Sortie Optimizer
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Google OR-Tools CP-SAT multi-objective mathematical optimizer. Evaluates 8 physical
                  and operational hard constraints (fuel buffers, weapon weight, rest hours, MTOW)
                  to generate Top-3 distinct rank-ordered sortie packages in under 50ms.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Google OR-Tools CP-SAT</span>
                <button
                  onClick={() => onLaunchDashboard('MAP')}
                  className="text-amber-400 hover:text-white transition-colors cursor-pointer font-bold"
                >
                  View Optimizer →
                </button>
              </div>
            </div>

            {/* Capability 3 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-rose-500/20 hover:border-rose-400/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 group-hover:shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/40 font-semibold">
                    TACTICAL DEFENCE
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition-colors">
                  Dynamic SAM Threat & Runway Evasion
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Real-time mathematical replanning when conditions change: instant fuel-buffered
                  airbase diversion on runway lockouts, geometric tangent detour waypoints
                  outside pop-up SAM bubbles, and standby replacement scrambles.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Shapely Geometry Engine</span>
                <button
                  onClick={() => onLaunchDashboard('MAP')}
                  className="text-rose-400 hover:text-white transition-colors cursor-pointer font-bold"
                >
                  Test Scenarios →
                </button>
              </div>
            </div>

            {/* Capability 4 - Data Fusion & Radar Sensors */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-sky-500/20 hover:border-sky-400/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all">
                    <Database className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-600/40 font-semibold">
                    10 FEEDS
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                  Sensor Telemetry & Data Fusion
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Real-time aggregation across 10 operational feeds: radar returns, weapon stocks,
                  runway statuses, weather hazards, and pilot telemetry with automated schema
                  validation and freshness confidence tracking.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Pydantic Schema Validation</span>
                <button
                  onClick={() => onLaunchDashboard('DATA_FUSION')}
                  className="text-sky-400 hover:text-white transition-colors cursor-pointer font-bold"
                >
                  Trust Centre →
                </button>
              </div>
            </div>

            {/* Capability 5 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all">
                    <Plane className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-600/40 font-semibold">
                    COMBAT & ROTARY
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Fighter & Rotary Wing Readiness
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Comprehensive tracking of frontline combat jets (Rafale, Su-30MKI, Tejas Mk1A,
                  Mirage 2000) and combat helicopters (Mi-17V5, LCH Prachand). Real-time monitoring of status,
                  turnaround cycles, fuel reserves, and MTOW thresholds.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Multi-Squadron Inventory</span>
                <button
                  onClick={() => onLaunchDashboard('DASHBOARD')}
                  className="text-emerald-400 hover:text-white transition-colors cursor-pointer font-bold"
                >
                  Fleet Matrix →
                </button>
              </div>
            </div>

            {/* Capability 6 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all">
                    <Fuel className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/40 font-semibold">
                    LOGISTICS & MRO
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Precision Munitions & Base Logistics
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Target hardness matching against verified airbase armories (Spice-2000, Rudram-1,
                  Astra Mk1, Hammer AASM, BrahMos-NG), calculating safety buffers and payload weight
                  impacts on combat radius.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Armory Stock & Turnaround</span>
                <button
                  onClick={() => onLaunchDashboard('MAINTENANCE')}
                  className="text-amber-400 hover:text-white transition-colors cursor-pointer font-bold"
                >
                  MRO Centre →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 4. PLATFORM WORKFLOW SECTION                                          */}
      {/* --------------------------------------------------------------------- */}
      <section id="workflow" className="py-20 px-4 lg:px-8 border-b border-slate-800/80 bg-slate-950/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md glass-panel border border-[#FF9933]/30 text-amber-400 font-mono text-xs font-semibold tracking-wider mb-3">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>IAF MISSION EXECUTION PIPELINE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              From Multi-Sensor Telemetry to Actionable Air Strikes
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              A transparent 4-stage optimization pipeline combining physical aerodynamics,
              mathematical constraint satisfaction, and strict commander authorization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-sky-500/20 relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black font-mono text-sky-400/80">01</span>
                  <div className="w-10 h-10 rounded-lg bg-sky-950 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Database className="w-5 h-5" />
                  </div>
                </div>
                <h4 className="text-base font-bold text-white">Data Ingestion</h4>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Aggregates operational runway statuses, aircraft readiness, pilot fatigue
                  logs, armory munitions, and real-time SAM/EW geospatial threat polygons.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>10 Live Core Collections</span>
                <button
                  onClick={() => onLaunchDashboard('DATA_FUSION')}
                  className="text-sky-400 hover:text-white transition-colors cursor-pointer"
                >
                  Data Fusion →
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-amber-500/20 relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black font-mono text-amber-400/80">02</span>
                  <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <FileCheck className="w-5 h-5" />
                  </div>
                </div>
                <h4 className="text-base font-bold text-white">Physical Hard Constraints</h4>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Applies 8 hard operational constraints (C1-C8). Discards ineligible candidates
                  violating rest hours, weapon match, MTOW, or combat range safety margins.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                8 Hard Operational Checks
              </div>
            </div>

            {/* Step 3 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-sky-500/20 relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black font-mono text-sky-400/80">03</span>
                  <div className="w-10 h-10 rounded-lg bg-sky-950 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                </div>
                <h4 className="text-base font-bold text-white">CP-SAT Optimization</h4>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Google OR-Tools executes integer-scaled multi-objective optimization,
                  minimizing fuel burn, threat exposure, and turnaround time.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                Top-3 Distinct Packages Ranked
              </div>
            </div>

            {/* Step 4 */}
            <div className="glass-panel glass-panel-interactive p-6 rounded-2xl border border-emerald-500/30 relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black font-mono text-emerald-400/80">04</span>
                  <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Shield className="w-5 h-5" />
                  </div>
                </div>
                <h4 className="text-base font-bold text-white">Commander Authorization</h4>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Commander reviews the 8-point satisfaction checklist, weapon loadout, and
                  flight corridor. Final deployment authorization remains strictly with human command.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-800 text-[10px] font-mono text-emerald-400 font-semibold flex items-center justify-between">
                <span>Human Authorization Required</span>
                <button
                  onClick={() => onLaunchDashboard('AUDIT')}
                  className="text-amber-400 hover:text-white transition-colors cursor-pointer text-[10px]"
                >
                  Audit Trail →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 5. ABOUT SECTION                                                      */}
      {/* --------------------------------------------------------------------- */}
      <section id="about" className="py-20 px-4 lg:px-8 border-b border-slate-800/80 bg-slate-950/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md glass-panel border border-slate-700 text-slate-300 font-mono text-xs font-semibold tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>THE OPERATIONAL MANDATE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Command Superiority in Contested Airspace
            </h2>
          </div>

          <div className="glass-panel p-8 rounded-2xl border border-slate-700/80 space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
            <p>
              In contemporary aerospace warfare, operational air commanders face severe cognitive saturation.
              Mission success depends on synthesizing thousands of variables in seconds: multi-role fighter
              payloads, pilot flight hours, runway damage, real-time meteorological hazards, fuel reserves,
              and hostile surface-to-air missile radar envelopes.
            </p>
            <p>
              When a runway is neutralized or an unexpected pop-up S-400 radar bubble appears along an ingress flight path,
              traditional manual calculation requires crucial minutes.
            </p>
            <div className="border-l-2 border-[#FF9933] pl-4 text-amber-100 font-mono text-xs sm:text-sm bg-amber-950/20 py-3 rounded-r-lg space-y-1">
              <div className="text-[#FF9933] font-bold">Bharatiya Vayu Sena Operations Architecture delivers:</div>
              <div>• Multi-objective CP-SAT integer optimization solving in under 50 milliseconds.</div>
              <div>• Instant evasive tangent rerouting around hostile radar envelopes.</div>
              <div>• Transparent 8-point physical constraint verification with zero black-box obscurity.</div>
              <div>• Final sortie commitment remaining strictly under human command oversight.</div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 6. FOOTER                                                             */}
      {/* --------------------------------------------------------------------- */}
      <footer className="py-12 px-4 lg:px-8 bg-[#040812] text-slate-400 text-xs font-mono border-t border-slate-800 relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] iaf-tricolor-gradient opacity-50" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1.5 text-center md:text-left">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm tracking-wider font-mono">
                BHARATIYA VAYU SENA (INDIAN AIR FORCE)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 max-w-md">
              Integrated Air Command & Control System (IACCS) • Tactical Aerospace Operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
            <span>FastAPI</span>
            <span>•</span>
            <span>Google OR-Tools CP-SAT</span>
            <span>•</span>
            <span>React 19 + TypeScript</span>
            <span>•</span>
            <span>Leaflet + Esri World Imagery</span>
            <span>•</span>
            <span>Tailwind CSS</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-amber-400/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Tactical Air Operations</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
