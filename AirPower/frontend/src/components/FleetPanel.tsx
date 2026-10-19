import React, { useState } from 'react';
import { Plane, Users, Fuel, ChevronDown, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Aircraft, Airbase, Pilot } from '../types';

interface FleetPanelProps {
  aircraftList: Aircraft[];
  airbases: Airbase[];
  pilots: Pilot[];
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  aircraftList,
  airbases,
  pilots,
}) => {
  const [activeTab, setActiveTab] = useState<'FLEET' | 'PILOTS' | 'BASES'>('FLEET');
  const [filterModel, setFilterModel] = useState<string>('ALL');

  const readyJetsCount = aircraftList.filter((a) => a.status === 'READY').length;
  const totalJetsCount = aircraftList.length;
  const readyPilotsCount = pilots.filter((p) => p.rest_hours_completed >= 8.0 && !p.assigned_aircraft_id).length;
  const totalPilotsCount = pilots.length;
  const totalFuelLiters = airbases.reduce((acc, b) => acc + b.available_fuel_liters, 0);

  const filteredAircraft = filterModel === 'ALL'
    ? aircraftList
    : aircraftList.filter((a) => a.model.includes(filterModel));

  return (
    <div className="w-full h-full flex flex-col glass-panel overflow-hidden border-r border-cyan-500/20 text-xs font-mono select-none">
      {/* Panel Header & KPI Readiness Cards */}
      <div className="p-4 border-b border-slate-800 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-cyan-400" />
            <h2 className="font-bold text-sm tracking-wider text-slate-100 font-sans">
              FLEET & READINESS
            </h2>
          </div>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
            TOTAL ASSETS: {totalJetsCount}
          </span>
        </div>

        {/* 3 Metric Readiness Tiles */}
        <div className="grid grid-cols-3 gap-2">
          {/* Ready Jets */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-tight">Ready Jets</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-emerald-400 font-sans">
                {readyJetsCount}
                <span className="text-xs font-normal text-slate-500">/{totalJetsCount}</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {Math.round((readyJetsCount / totalJetsCount) * 100)}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(readyJetsCount / totalJetsCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Pilot Availability */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-tight">Rested Pilots</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-cyan-400 font-sans">
                {readyPilotsCount}
                <span className="text-xs font-normal text-slate-500">/{totalPilotsCount}</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-semibold">
                {Math.round((readyPilotsCount / totalPilotsCount) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(readyPilotsCount / totalPilotsCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Fuel Reserves */}
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-tight">Fuel Reserves</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-amber-400 font-sans">
                {(totalFuelLiters / 1000000).toFixed(2)}
                <span className="text-xs font-normal text-slate-500">M L</span>
              </span>
              <Fuel className="w-3 h-3 text-amber-400" />
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full w-4/5" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('FLEET')}
            className={`flex-1 py-1 text-center rounded text-[11px] font-semibold transition-all ${
              activeTab === 'FLEET'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fighter Fleet ({aircraftList.length})
          </button>
          <button
            onClick={() => setActiveTab('PILOTS')}
            className={`flex-1 py-1 text-center rounded text-[11px] font-semibold transition-all ${
              activeTab === 'PILOTS'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pilots ({pilots.length})
          </button>
          <button
            onClick={() => setActiveTab('BASES')}
            className={`flex-1 py-1 text-center rounded text-[11px] font-semibold transition-all ${
              activeTab === 'BASES'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Airbases ({airbases.length})
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* TAB 1: FLEET TABLE */}
        {activeTab === 'FLEET' && (
          <div className="space-y-2">
            {/* Model Filter Pills */}
            <div className="flex items-center gap-1 pb-1 overflow-x-auto text-[10px]">
              {['ALL', 'Rafale', 'Su-30', 'Tejas', 'Mirage'].map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterModel(m)}
                  className={`px-2 py-0.5 rounded border transition-all ${
                    filterModel === m
                      ? 'bg-cyan-600/40 border-cyan-400 text-cyan-200 font-bold'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Aircraft Cards */}
            <div className="space-y-2">
              {filteredAircraft.map((ac) => {
                const base = airbases.find((b) => b.id === ac.home_base_id);
                const isReady = ac.status === 'READY';
                const isAirborne = ac.status === 'AIRBORNE';
                const isMaint = ac.status === 'MAINTENANCE';
                const isAborted = ac.status === 'ABORTED';

                return (
                  <div
                    key={ac.aircraft_id}
                    className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 hover:border-cyan-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 font-sans">{ac.callsign}</span>
                        <span className="text-[10px] text-slate-400">({ac.model})</span>
                      </div>
                      {/* Status Chip */}
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          isReady
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
                    </div>

                    {/* Telemetry Bar */}
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 bg-slate-950/40 p-1.5 rounded">
                      <div>
                        <span className="text-slate-500 block">BASE:</span>
                        <span className="text-slate-300 font-semibold">{base?.name.split(' ')[0]}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">FUEL:</span>
                        <span className="text-cyan-300 font-semibold">{ac.current_fuel_pct}% ({ac.max_range_km}km)</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">HARDPOINTS:</span>
                        <span className="text-slate-300 font-semibold">{ac.total_equipped_weapons_count}/{ac.hardpoints_count}</span>
                      </div>
                    </div>

                    {/* Munitions Tags */}
                    {ac.equipped_weapons.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {ac.equipped_weapons.map((eq, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                          >
                            {eq.quantity}x {eq.weapon_id.replace('WEP_', '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PILOTS ROSTER */}
        {activeTab === 'PILOTS' && (
          <div className="space-y-2">
            {pilots.map((p) => {
              const isRested = p.rest_hours_completed >= 8.0;
              const isAssigned = !!p.assigned_aircraft_id;
              const base = airbases.find((b) => b.id === p.home_base_id);

              return (
                <div
                  key={p.pilot_id}
                  className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 hover:border-cyan-500/30 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-100 font-sans text-[13px]">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.rank} • {base?.name.split(' ')[0]}</div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        isAssigned
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                          : isRested
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                      }`}
                    >
                      {isAssigned ? 'AIRBORNE' : isRested ? 'RESTED' : 'FATIGUED'}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/40 p-1.5 rounded">
                    <span>Rest Completed: <strong className={isRested ? 'text-emerald-400' : 'text-rose-400'}>{p.rest_hours_completed}h</strong></span>
                    <span>Flight Hours: <strong>{p.consecutive_flight_hours}h</strong></span>
                  </div>

                  {/* Qualifications */}
                  <div className="flex flex-wrap gap-1">
                    {p.qualifications.map((q, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30"
                      >
                        {q.replace('_CERTIFIED', '').replace('_OPERATIONS', '')}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: AIRBASES */}
        {activeTab === 'BASES' && (
          <div className="space-y-2">
            {airbases.map((base) => {
              const isOp = base.runway_status === 'OPERATIONAL';
              return (
                <div
                  key={base.id}
                  className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 hover:border-cyan-500/30 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 font-sans">{base.name}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        isOp
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                      }`}
                    >
                      {base.runway_status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Aviation Fuel Reserve:</span>
                      <span className="text-cyan-300 font-bold">{(base.available_fuel_liters / 1000).toLocaleString()}k Liters</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Coordinates:</span>
                      <span>{base.lat.toFixed(2)}°N, {base.lng.toFixed(2)}°E</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
