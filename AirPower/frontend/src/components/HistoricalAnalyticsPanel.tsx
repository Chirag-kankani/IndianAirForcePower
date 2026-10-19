import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldAlert,
  Layers,
  Wrench,
  Package,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { fetchHistoricalAnalytics, fetchForecast } from '../services/api';
import type { HistoricalAnalyticsResponse, ForecastResponse } from '../types';

export const HistoricalAnalyticsPanel: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [historicalData, setHistoricalData] = useState<HistoricalAnalyticsResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async (selectedDays: number) => {
    setIsLoading(true);
    try {
      const [hist, fc] = await Promise.all([
        fetchHistoricalAnalytics(selectedDays),
        fetchForecast(14),
      ]);
      setHistoricalData(hist);
      setForecastData(fc);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(days);
  }, [days]);

  return (
    <div className="w-full space-y-6 font-mono text-slate-100 select-none">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-wider text-white">
              HISTORICAL ANALYTICS & PREDICTIVE FORECASTING
            </h3>
            <p className="text-xs text-slate-400">
              Readiness trends, maintenance turnaround throughput, spare drawdown rates, and transparent forecasting.
            </p>
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs self-start md:self-auto">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                days === d
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PAST {d} DAYS
            </button>
          ))}
        </div>
      </div>

      {/* ─── SECTION 1: HISTORICAL SERVICEABILITY TRENDS ────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-extrabold text-cyan-300 tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Aircraft Serviceability & Readiness Trend (Past {days} Days)</span>
          </h4>
          <span className="text-[10px] text-slate-400">
            Measured against {historicalData?.metadata?.active_assets_evaluated || 23} fleet assets
          </span>
        </div>

        {/* Readiness Trend Mini Bars */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {historicalData?.readiness_trend.slice(-8).map((pt, idx) => (
              <div
                key={idx}
                className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-2 text-center"
              >
                <div className="text-[10px] text-slate-400 font-bold">{pt.date}</div>
                <div className="text-base font-black text-cyan-300">{pt.readiness_pct}%</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full"
                    style={{ width: `${pt.readiness_pct}%` }}
                  />
                </div>
                <div className="text-[9px] text-slate-500">
                  {pt.ready_aircraft}/{pt.total_aircraft} Ready
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: WORK ORDERS THROUGHPUT & INVENTORY HEALTH ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Maintenance Throughput */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h4 className="text-xs uppercase font-extrabold text-white tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Maintenance Work-Orders Throughput</span>
          </h4>

          <div className="space-y-2">
            {historicalData?.work_orders_throughput.slice(-5).map((wo, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <span className="font-bold text-slate-300">{wo.date}</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-400 font-bold">{wo.completed} Signed-off</span>
                  <span className="text-amber-400 font-bold">{wo.open} Open</span>
                  {wo.overdue > 0 && (
                    <span className="text-rose-400 font-bold">{wo.overdue} Overdue</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Support Inventory Health */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h4 className="text-xs uppercase font-extrabold text-white tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Logistics Stock Health & Reorder Events</span>
          </h4>

          <div className="space-y-2">
            {historicalData?.inventory_turnover.slice(-5).map((inv, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <span className="font-bold text-slate-300">{inv.date}</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-slate-400">Stock Health:</span>
                  <span className="text-emerald-300 font-bold">{inv.average_stock_health_pct}%</span>
                  <span className="text-[10px] text-slate-500">
                    {inv.reorders_triggered > 0 ? '⚠️ Reorder Triggered' : '✓ Stock Nominal'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: TRANSPARENT PREDICTIVE FORECASTING ──────────────────── */}
      {forecastData && (
        <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">
                  14-Day Predictive Maintenance & Drawdown Forecast
                </h4>
                <div className="text-[11px] text-slate-400">
                  Methodology: <strong className="text-cyan-300">{forecastData.model_methodology}</strong>{' '}
                  (Confidence Level: <strong className="text-emerald-400">{forecastData.confidence_level}%</strong>)
                </div>
              </div>
            </div>

            <span className="text-[10px] px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider self-start sm:self-auto">
              SYNTHETIC PROJECTION MODEL
            </span>
          </div>

          {/* Model Assumptions Box */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Underlying Modeling Assumptions:
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
              {forecastData.assumptions.map((ass, i) => (
                <li key={i}>{ass}</li>
              ))}
            </ul>
          </div>

          {/* 14-Day Maintenance Forecast Grid */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase">
              Projected Scheduled Maintenance Pipeline (Next 14 Days):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {forecastData.maintenance_workload_forecast.slice(0, 7).map((fc, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-center space-y-1"
                >
                  <div className="text-[10px] text-slate-400 font-bold">{fc.date}</div>
                  <div className="text-lg font-black text-amber-300">
                    {fc.projected_new_work_orders > 0 ? `+${fc.projected_new_work_orders} WO` : '0 WO'}
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">{fc.primary_driver}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Spares Depletion Forecast */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-slate-300 uppercase">
              Critical Spare Parts Depletion & Lead Time Warnings:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {forecastData.inventory_depletion_forecast.map((inv, idx) => {
                const isUrgent = inv.projected_days_to_reorder <= 2;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isUrgent
                        ? 'bg-rose-950/30 border-rose-600/40 text-rose-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white text-xs">{inv.item_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {inv.airbase_id} • Current: {inv.current_stock} (Reorder @ {inv.reorder_threshold})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-xs ${isUrgent ? 'text-rose-400' : 'text-cyan-300'}`}>
                        {inv.projected_days_to_reorder === 0 ? 'DEFICIT NOW' : `~${inv.projected_days_to_reorder} days to reorder`}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Lead time: {inv.lead_time_days} days
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Synthetic Transparency Footnote */}
          <div className="text-[10px] text-slate-500 font-sans italic border-t border-slate-800/80 pt-2">
            {forecastData.synthetic_notice}
          </div>
        </div>
      )}
    </div>
  );
};
