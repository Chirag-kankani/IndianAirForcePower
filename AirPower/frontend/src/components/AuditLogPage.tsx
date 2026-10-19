import React, { useState, useMemo } from 'react';
import {
  History,
  ShieldAlert,
  Search,
  Filter,
  Download,
  ArrowRight,
  Plane,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Map as MapIcon,
  LayoutDashboard,
  RotateCcw,
  Clock,
  Radio,
  ChevronDown,
  ChevronUp,
  FileText,
  Flame,
  Code2,
} from 'lucide-react';
import type { EventLogEntry, RetaskAction } from '../types';

interface AuditLogPageProps {
  eventLogs: EventLogEntry[];
  onNavigateToMap: () => void;
  onNavigateToDashboard: () => void;
  onResetScenario?: () => void;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({
  eventLogs,
  onNavigateToMap,
  onNavigateToDashboard,
  onResetScenario,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [expandedPayloadIds, setExpandedPayloadIds] = useState<Set<string>>(new Set());

  const togglePayload = (id: string) => {
    setExpandedPayloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return [...eventLogs].reverse().filter((log) => {
      const typeStr = typeof log.event_type === 'string' ? log.event_type : (log.event_type?.value || String(log.event_type));
      const matchesType = selectedType === 'ALL' || typeStr === selectedType;
      const term = searchTerm.toLowerCase();
      const actions = log.retasking_actions || [];
      const matchesSearch =
        !term ||
        typeStr.toLowerCase().includes(term) ||
        (log.description || '').toLowerCase().includes(term) ||
        (log.entity_id || '').toLowerCase().includes(term) ||
        (log.entity_type || '').toLowerCase().includes(term) ||
        (log.source || '').toLowerCase().includes(term) ||
        actions.some(
          (a) =>
            (a.details || '').toLowerCase().includes(term) ||
            (a.action_type || '').toLowerCase().includes(term) ||
            (a.reason || '').toLowerCase().includes(term)
        );
      return matchesType && matchesSearch;
    });
  }, [eventLogs, selectedType, searchTerm]);

  // Aggregate Stats
  const totalRetasks = useMemo(() => {
    return eventLogs.reduce((acc, log) => acc + (log.retasking_actions?.length || 0), 0);
  }, [eventLogs]);

  const runwayLockoutsCount = useMemo(() => {
    return eventLogs.filter((log) => log.event_type === 'RUNWAY_BLOCKED').length;
  }, [eventLogs]);

  const samThreatsCount = useMemo(() => {
    return eventLogs.filter((log) => log.event_type === 'NEW_THREAT_ZONE').length;
  }, [eventLogs]);

  const aircraftFailuresCount = useMemo(() => {
    return eventLogs.filter((log) => log.event_type === 'AIRCRAFT_FAILURE').length;
  }, [eventLogs]);

  // JSON Export
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(eventLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `airops_audit_log_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 w-full h-full bg-[#070B14] text-slate-100 flex flex-col overflow-y-auto select-none p-4 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header Card */}
        <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <History className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white">
                  TACTICAL EVENT AUDIT LOG
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full chronological ledger of dynamic re-planning triggers, diversions, detour vectors, and standby scrambles.
              </p>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportJson}
              disabled={eventLogs.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download Audit Log as JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPORT JSON</span>
            </button>

            <button
              onClick={onNavigateToMap}
              className="px-3.5 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>RETURN TO MAP</span>
            </button>

            <button
              onClick={onNavigateToDashboard}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>DASHBOARD</span>
            </button>
          </div>
        </div>

        {/* Aggregate Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 font-mono">
          <div className="glass-panel p-4 rounded-xl border border-cyan-500/20">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>TOTAL LOGGED EVENTS</span>
              <History className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">{eventLogs.length}</div>
            <div className="text-[10px] text-cyan-300 mt-0.5">Chronological Session Audit</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-cyan-500/20">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>AUTONOMOUS RETASKS</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-300 mt-1">{totalRetasks}</div>
            <div className="text-[10px] text-emerald-400/90 mt-0.5">CP-SAT Evasion Actions</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-cyan-500/20">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>RUNWAY LOCKOUTS</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-300 mt-1">{runwayLockoutsCount}</div>
            <div className="text-[10px] text-rose-400/90 mt-0.5">Base Diversion Sorties</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-cyan-500/20">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>POP-UP SAM BUBBLES</span>
              <Radio className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 mt-1">{samThreatsCount}</div>
            <div className="text-[10px] text-amber-400/90 mt-0.5">Dynamic Detour Waypoints</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search callsign, base, incident..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Filter:</span>
            {[
              'ALL',
              'RUNWAY_BLOCKED',
              'NEW_THREAT_ZONE',
              'AIRCRAFT_FAILURE',
              'MAINTENANCE_UPDATE',
              'APPROVAL_DECISION',
              'SYSTEM_VALIDATION',
              'RESET',
            ].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                  selectedType === type
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Log Timeline */}
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <History className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">No Tactical Events Recorded</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Trigger an emergency scenario (such as Runway Lockout, Pop-Up SAM Radar, or In-Flight Engine Fault) from the Tactical Map to observe live CP-SAT mathematical replanning records.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    onClick={onNavigateToMap}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-mono text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                  >
                    <MapIcon className="w-4 h-4" />
                    <span>LAUNCH TACTICAL MAP CONTROLLER</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const typeStr = typeof log.event_type === 'string' ? log.event_type : (log.event_type?.value || String(log.event_type));
              const isBlocked = typeStr === 'RUNWAY_BLOCKED';
              const isThreat = typeStr === 'NEW_THREAT_ZONE';
              const isFailure = typeStr === 'AIRCRAFT_FAILURE';
              const isMaint = typeStr === 'MAINTENANCE_UPDATE';
              const isAppr = typeStr === 'APPROVAL_DECISION';
              const isExpanded = expandedPayloadIds.has(log.event_id);

              const badgeColor = isBlocked || isFailure
                ? 'bg-rose-950 text-rose-300 border-rose-600'
                : isThreat
                ? 'bg-amber-950 text-amber-300 border-amber-600'
                : isMaint
                ? 'bg-purple-950 text-purple-300 border-purple-600'
                : isAppr
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                : 'bg-cyan-950 text-cyan-300 border-cyan-600';

              const severityColor = log.severity === 'CRITICAL'
                ? 'bg-rose-900/60 text-rose-300 border-rose-500/50'
                : log.severity === 'WARNING'
                ? 'bg-amber-900/60 text-amber-300 border-amber-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700';

              return (
                <div
                  key={log.event_id}
                  className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all space-y-3 font-mono"
                >
                  {/* Event Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${badgeColor}`}>
                        {typeStr.replace(/_/g, ' ')}
                      </span>
                      {log.severity && (
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${severityColor}`}>
                          {log.severity}
                        </span>
                      )}
                      {log.source && (
                        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          src: {log.source}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        ID: <strong className="text-slate-200">{log.event_id}</strong>
                      </span>
                      {log.entity_id && (
                        <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                          {log.entity_type || 'ENTITY'}: {log.entity_id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{new Date(log.timestamp).toLocaleTimeString()} IST</span>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>{new Date(log.timestamp).toUTCString().slice(17, 25)} UTC</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="text-sm font-sans text-slate-100 font-medium">
                    {log.description}
                  </div>

                  {/* Retasking Actions Detail Cards */}
                  {log.retasking_actions && log.retasking_actions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Autonomous CP-SAT Retasking Actions ({log.retasking_actions.length}):</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {log.retasking_actions.map((act, aIdx) => (
                          <div
                            key={aIdx}
                            className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{act.action_type}</span>
                              </span>
                              {act.added_time_mins !== undefined && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-600/40 font-bold">
                                  +{act.added_time_mins}m ETD Impact
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-sans text-slate-300 leading-relaxed">
                              {act.details}
                            </p>
                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                              Reason: {act.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Payload Inspector Toggle */}
                  <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800/80">
                    <button
                      onClick={() => togglePayload(log.event_id)}
                      className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isExpanded ? 'Hide Raw Telemetry' : 'Inspect Raw JSON Payload'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[10px] text-slate-500">
                      Validated System Audit
                    </span>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 font-mono overflow-x-auto max-h-60">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
