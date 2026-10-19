import React, { useState, useEffect } from 'react';
import {
  Clock,
  Map,
  LayoutDashboard,
  Home,
  History,
  Database,
  Wrench,
  RotateCcw,
  CloudRain,
  Bot,
} from 'lucide-react';
import { WSConnectionStatus } from '../services/useTacticalWebSocket';

export type AppNavView =
  | 'LANDING'
  | 'MAP'
  | 'DASHBOARD'
  | 'WEATHER'
  | 'DATA_FUSION'
  | 'MAINTENANCE'
  | 'REPLAY'
  | 'AUDIT'
  | 'ASSISTANT';

interface HeaderProps {
  wsStatus?: WSConnectionStatus;
  activeMissionsCount: number;
  activeView: AppNavView | string;
  onSelectView: (view: AppNavView) => void;
  eventLogsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  wsStatus: _wsStatus,
  activeMissionsCount,
  activeView,
  onSelectView,
  eventLogsCount = 0,
}) => {
  const [timeUtc, setTimeUtc] = useState('');
  const [timeIst, setTimeIst] = useState('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + ' UTC');
      setTimeIst(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    };
    updateClocks();
    const timer = setInterval(updateClocks, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="relative h-16 px-3 sm:px-4 md:px-5 glass-panel border-b border-sky-400/30 flex items-center justify-between z-30 shrink-0 select-none gap-2 overflow-hidden shadow-[0_4px_24px_rgba(2,132,199,0.18)]">
      {/* Luminous Skyblue Atmospheric Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-sky-400 via-sky-200 to-cyan-300 opacity-90 shadow-[0_0_10px_rgba(56,189,248,0.8)] pointer-events-none" />

      {/* IAF Tricolor Bottom Accent Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] iaf-tricolor-gradient opacity-90 shadow-[0_0_8px_rgba(255,153,51,0.5)] pointer-events-none" />

      {/* 1. Left: Brand Title (IAF Roundel & Bharatiya Vayu Sena) */}
      <div
        onClick={() => onSelectView('LANDING')}
        className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        title="Return to IAF Aerospace Operations Portal"
      >
        {/* IAF Roundel Insignia */}
        <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 border border-slate-700/80 shadow-[0_0_12px_rgba(255,153,51,0.35)] group-hover:scale-105 transition-all">
          <svg viewBox="0 0 100 100" className="w-7 h-7 sm:w-8 sm:h-8 filter drop-shadow">
            <circle cx="50" cy="50" r="48" fill="#FF9933" />
            <circle cx="50" cy="50" r="32" fill="#FFFFFF" />
            <circle cx="50" cy="50" r="16" fill="#138808" />
          </svg>
          <div className="absolute inset-0 rounded-full border border-sky-400/30 pulsing-ring pointer-events-none" />
        </div>

        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-black tracking-wider text-white font-mono flex items-center gap-1">
              <span className="text-[#FF9933]">BHARATIYA</span>
              <span className="text-slate-100">VAYU</span>
              <span className="text-[#10B981]">SENA</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-sans tracking-wide leading-none">
            <span>Tactical Air Operations</span>
            <span className="text-sky-300/90 ml-1.5 font-medium italic">नभः स्पृशं दीप्तम्</span>
          </div>
        </div>
      </div>

      {/* 2. Center: Primary View Switcher Navigation - Non-colliding compact layout */}
      <nav className="flex items-center bg-slate-950/85 p-0.5 sm:p-1 rounded-xl border border-sky-500/25 font-mono text-[11px] shadow-inner gap-0.5 overflow-x-auto max-w-full">
        <button
          onClick={() => onSelectView('LANDING')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'LANDING'
              ? 'bg-sky-500/25 text-white border border-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Strategic Command Portal"
        >
          <Home className="w-3.5 h-3.5 text-sky-400" />
          <span>PORTAL</span>
        </button>

        <button
          onClick={() => onSelectView('MAP')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'MAP'
              ? 'bg-[#FF9933]/25 text-amber-200 border border-[#FF9933]/60 shadow-[0_0_10px_rgba(255,153,51,0.35)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Tactical Map & Sortie Planner"
        >
          <Map className="w-3.5 h-3.5 text-[#FF9933]" />
          <span>MAP</span>
        </button>

        <button
          onClick={() => onSelectView('DASHBOARD')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'DASHBOARD'
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Force Readiness Hub & Assets"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
          <span>DASHBOARD</span>
        </button>

        <button
          onClick={() => onSelectView('WEATHER')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'WEATHER'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Meteorology & Environmental Risk"
        >
          <CloudRain className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">WEATHER</span>
        </button>

        <button
          onClick={() => onSelectView('DATA_FUSION')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'DATA_FUSION'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Data Fusion & Sensor Telemetry"
        >
          <Database className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">DATA FUSION</span>
        </button>

        <button
          onClick={() => onSelectView('MAINTENANCE')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'MAINTENANCE'
              ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Base MRO Logistics & Armory"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">MRO</span>
        </button>

        <button
          onClick={() => onSelectView('REPLAY')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'REPLAY'
              ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/60 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Post-Mission Debrief & Tactical Replay"
        >
          <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
          <span>REPLAY</span>
        </button>

        <button
          onClick={() => onSelectView('AUDIT')}
          className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'AUDIT'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
          title="Tactical Mission Audit Trail"
        >
          <History className="w-3.5 h-3.5 text-sky-400" />
          <span>AUDIT</span>
          {eventLogsCount > 0 && (
            <span className="text-[9px] px-1 py-0.2 rounded-full bg-sky-500/30 text-sky-200 font-mono">
              {eventLogsCount}
            </span>
          )}
        </button>

        {/* Restored Chatbot Navigation Button */}
        <button
          onClick={() => onSelectView('ASSISTANT')}
          className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-bold shrink-0 ${
            activeView === 'ASSISTANT'
              ? 'bg-gradient-to-r from-amber-500/30 via-sky-500/30 to-emerald-500/30 text-amber-200 border border-amber-400/60 shadow-[0_0_12px_rgba(255,153,51,0.4)]'
              : 'text-amber-300 hover:text-white hover:bg-amber-950/40 border border-amber-500/30'
          }`}
          title="Tactical Operations Assistant & Advisory Chatbot"
        >
          <Bot className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>CHATBOT</span>
        </button>
      </nav>

      {/* 3. Right: Consolidated Telemetry Cluster (NO COLLISION with REPLAY) */}
      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
        {/* Sortie Count Badge - placed cleanly inside the right status cluster */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-sky-500/30 shadow-inner">
          <span className="relative flex h-2 w-2">
            {activeMissionsCount > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${activeMissionsCount > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
          </span>
          <span className="text-slate-400 text-[10px] sm:text-xs">SORTIES:</span>
          <span className={`font-bold ${activeMissionsCount > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
            {activeMissionsCount}
          </span>
        </div>

        {/* Live IST & UTC Clocks */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-sky-500/30 text-slate-300 shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF9933] shadow-[0_0_6px_rgba(255,153,51,0.8)]" />
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-200 font-semibold">{timeIst}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{timeUtc}</span>
        </div>
      </div>
    </header>
  );
};
