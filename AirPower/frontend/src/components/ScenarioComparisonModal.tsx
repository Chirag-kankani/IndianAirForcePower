import React from 'react';
import {
  GitCompare,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Flame,
} from 'lucide-react';
import type { ScenarioComparison } from '../types';

interface ScenarioComparisonModalProps {
  comparison: ScenarioComparison | null;
  onClose: () => void;
  onResetScenario: () => void;
  isResetting?: boolean;
}

export const ScenarioComparisonModal: React.FC<ScenarioComparisonModalProps> = ({
  comparison,
  onClose,
  onResetScenario,
  isResetting = false,
}) => {
  if (!comparison) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none overflow-y-auto">
      <div className="bg-[#0B0F19] border border-cyan-500/40 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-wider">
                  TACTICAL SCENARIO BEFORE / AFTER DELTA COMPARISON
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {comparison.scenario_name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulated state change vs reference baseline (Applied at{' '}
                {new Date(comparison.applied_at).toLocaleTimeString()} IST).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Side-by-Side Metrics Delta Table */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Operational Readiness & Force Multipliers Delta:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {comparison.metrics.map((m, idx) => {
              const isDegraded = m.impact === 'DEGRADED';
              const isImproved = m.impact === 'IMPROVED';

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isDegraded
                      ? 'bg-rose-950/20 border-rose-600/30'
                      : isImproved
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{m.metric_name}</span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded font-mono ${
                        isDegraded
                          ? 'bg-rose-900/60 text-rose-300'
                          : isImproved
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {m.impact}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Baseline</span>
                      <span className="font-bold text-slate-400">
                        {m.baseline_value} {m.unit}
                      </span>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Simulated</span>
                      <span className="font-bold text-white">
                        {m.simulated_value} {m.unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Net Delta</span>
                      <span
                        className={`font-black text-sm ${
                          m.delta < 0
                            ? isDegraded
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                            : m.delta > 0
                            ? isImproved
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta} {m.unit}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Detected Capacity & Operational Conflicts */}
        {comparison.conflicts_detected && comparison.conflicts_detected.length > 0 && (
          <div className="bg-rose-950/25 p-4 rounded-xl border border-rose-600/40 space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Newly Detected Capacity & Constraints Conflicts ({comparison.conflicts_detected.length})</span>
            </div>
            <ul className="space-y-1.5 text-xs text-rose-200 font-sans">
              {comparison.conflicts_detected.map((conf, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{conf}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Affected Records */}
        {comparison.affected_records && comparison.affected_records.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Directly Affected Tactical Records:
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {comparison.affected_records.map((rec, i) => (
                <div
                  key={i}
                  className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                      {rec.entity_type}
                    </span>
                    <strong className="text-white">{rec.label}</strong>
                    <span className="text-[11px] text-slate-400">({rec.entity_id})</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">{rec.baseline_state}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="text-rose-300 font-bold">{rec.simulated_state}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans">
            Simulation mode active. Baseline data preserved in memory cache.
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onResetScenario();
                onClose();
              }}
              disabled={isResetting}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>RESTORE BASELINE</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              KEEP SIMULATION VIEW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
