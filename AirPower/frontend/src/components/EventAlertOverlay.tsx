import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plane,
  ChevronDown,
  ChevronUp,
  Radio,
} from 'lucide-react';
import type { EventLogEntry, RetaskAction } from '../types';

interface EventAlertOverlayProps {
  currentAlert: {
    event_id: string;
    event_type: string;
    message: string;
    retasking_actions: RetaskAction[];
    timestamp?: string;
  } | null;
  onDismissAlert: () => void;
  eventLogs: EventLogEntry[];
}

// ── Mod 2: Structured replacement card ──────────────────────────────────────
function ReplacementCard({ act }: { act: RetaskAction }) {
  const details = act.details;
  const isReplacement = act.action_type === 'REPLACED';

  // Extract original and replacement segments
  const origMatch = details.match(/ORIGINAL:\s*(.+?)\s*→\s*ABORTED/);
  const replMatch = details.match(/REPLACEMENT:\s*(.+?)\s+piloted by\s+(.+?)\s+from\s+(.+?)\.\s+New mission/);
  const newMsnMatch = details.match(/New mission ID:\s*(\S+)/);
  const delayMatch = details.match(/scramble delay:\s*\+(\d+)/);

  if (!isReplacement || !origMatch || !replMatch) {
    return (
      <div className="bg-black/60 p-2.5 rounded-xl border border-red-500/40 text-xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            RETASK: {act.action_type}
          </span>
          {act.added_time_mins !== undefined && (
            <span className="text-rose-300 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40 text-[10px]">
              +{act.added_time_mins} mins ETD Impact
            </span>
          )}
        </div>
        <div className="text-slate-200 text-xs leading-relaxed font-sans">{details}</div>
      </div>
    );
  }

  const originalAc = origMatch[1];
  const replacementAc = replMatch[1];
  const pilotName = replMatch[2];
  const baseName = replMatch[3];
  const newMsnId = newMsnMatch?.[1] ?? '—';
  const delay = delayMatch?.[1] ?? '?';

  return (
    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-emerald-500/40 text-xs flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-emerald-300 font-extrabold tracking-wider text-[11px]">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>STANDBY SCRAMBLE — REPLACEMENT</span>
        {delay && (
          <span className="ml-auto text-rose-300 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40 text-[10px] whitespace-nowrap">
            +{delay}m delay
          </span>
        )}
      </div>

      {/* OLD → NEW identity swap */}
      <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
        {/* Original (aborted) */}
        <div className="flex flex-col items-center text-center min-w-0">
          <Plane className="w-4 h-4 text-rose-400 mb-0.5" />
          <span className="font-bold text-rose-300 text-[10px] truncate max-w-[70px]">{originalAc}</span>
          <span className="text-[8px] text-rose-400 bg-rose-950/60 px-1 rounded border border-rose-500/30">
            ABORTED
          </span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mx-0.5" />

        {/* Replacement */}
        <div className="flex flex-col items-center text-center min-w-0">
          <Plane className="w-4 h-4 text-emerald-400 mb-0.5" />
          <span className="font-bold text-emerald-300 text-[10px] truncate max-w-[70px]">{replacementAc}</span>
          <span className="text-[8px] text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-500/30">
            SCRAMBLED
          </span>
        </div>

        {/* Details column */}
        <div className="flex-1 text-[9px] text-slate-300 space-y-0.5 pl-2 border-l border-slate-800 ml-1">
          <div><span className="text-slate-500">Pilot:</span> <strong className="text-slate-100">{pilotName}</strong></div>
          <div><span className="text-slate-500">Base:</span> <strong className="text-cyan-300">{baseName}</strong></div>
          <div><span className="text-slate-500">MSN:</span> <strong className="text-amber-300">{newMsnId}</strong></div>
        </div>
      </div>
    </div>
  );
}

// ── Abort card ───────────────────────────────────────────────────────────────
function AbortCard({ act }: { act: RetaskAction }) {
  return (
    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-rose-500/40 text-xs flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-extrabold text-rose-300 flex items-center gap-1.5 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          MISSION ABORTED — NO REPLACEMENT
        </span>
      </div>
      <div className="text-slate-300 text-[11px] leading-relaxed font-sans">{act.details}</div>
    </div>
  );
}

// ── Generic retask card (DIVERTED / REROUTED / DEPLOYED) ────────────────────
function RetaskCard({ act }: { act: RetaskAction }) {
  return (
    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/40 text-xs flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-extrabold text-amber-300 flex items-center gap-1.5 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          AUTONOMOUS RETASK: {act.action_type}
        </span>
        {act.added_time_mins !== undefined && (
          <span className="text-rose-300 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40 text-[10px]">
            +{act.added_time_mins} mins
          </span>
        )}
      </div>
      <div className="text-slate-300 text-[11px] leading-relaxed font-sans">{act.details}</div>
    </div>
  );
}

export const EventAlertOverlay: React.FC<EventAlertOverlayProps> = ({
  currentAlert,
  onDismissAlert,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine severity tier
  const isCritical =
    currentAlert?.event_type === 'AIRCRAFT_FAILURE' ||
    currentAlert?.retasking_actions?.some(
      (a) => a.action_type === 'REPLACED' || a.action_type === 'ABORTED'
    );
  const isHighThreat = currentAlert?.event_type === 'NEW_THREAT_ZONE';

  const severityBadge = isCritical ? (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/50 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
      SEV-1 CRITICAL
    </span>
  ) : isHighThreat ? (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/50 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
      SEV-2 THREAT
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
      TACTICAL ALERT
    </span>
  );

  const containerBorderClass = isCritical
    ? 'border-rose-500/70 shadow-[0_0_25px_rgba(244,63,94,0.35)]'
    : isHighThreat
    ? 'border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
    : 'border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]';

  if (!currentAlert) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-[450] flex flex-col items-end gap-2 max-w-[420px] w-[calc(100vw-2rem)] sm:w-[420px] pointer-events-none">
      {/* Tactical Toast Notification */}
      {currentAlert && (
        <div
          className={`w-full glass-panel-danger p-3 rounded-2xl border ${containerBorderClass} text-slate-100 font-mono space-y-2 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200`}
        >
          {/* Toast Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isCritical ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
              ) : isHighThreat ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              {severityBadge}
              <span className="text-[10px] text-slate-400 truncate">
                {currentAlert.timestamp || 'LIVE'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800/80 cursor-pointer text-[10px] flex items-center gap-0.5"
                title={isExpanded ? 'Collapse Alert Details' : 'Expand Alert Details'}
              >
                {isExpanded ? (
                  <>
                    <span>Less</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Details</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <button
                onClick={onDismissAlert}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/80 cursor-pointer"
                title="Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* High-Level Event Message */}
          <div className="text-xs text-slate-200 font-sans leading-snug flex items-start gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <strong className="text-slate-100 font-mono text-[11px] block">
                {currentAlert.event_type.replace(/_/g, ' ')}
              </strong>
              <span className="text-[11px] text-slate-300">{currentAlert.message}</span>
            </div>
          </div>

          {/* Expanded Retasking Action Cards */}
          {isExpanded && currentAlert.retasking_actions && currentAlert.retasking_actions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {currentAlert.retasking_actions.map((act, idx) => {
                if (act.action_type === 'REPLACED') return <ReplacementCard key={idx} act={act} />;
                if (act.action_type === 'ABORTED') return <AbortCard key={idx} act={act} />;
                return <RetaskCard key={idx} act={act} />;
              })}
            </div>
          )}

          {/* Critical persistence note or auto-dismiss hint */}
          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
            <span>{isCritical ? '⚠️ Critical alert remains until dismissed' : 'Auto-dismissing'}</span>
            <button
              onClick={onDismissAlert}
              className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
