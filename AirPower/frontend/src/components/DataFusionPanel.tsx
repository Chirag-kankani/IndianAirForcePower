import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileSearch,
  Filter,
  Layers,
  Activity,
  AlertOctagon,
  ArrowRight,
  Eye,
  X,
  Search,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchDataFusionReport,
  forceRevalidateData,
  inspectSourceCollection,
} from '../services/api';
import type { DataQualityReport, DataQualityAnomaly, DataSourceMeta } from '../types';

interface DataFusionPanelProps {
  onRefreshState?: () => void;
}

export const DataFusionPanel: React.FC<DataFusionPanelProps> = ({ onRefreshState }) => {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Source Collection Raw Inspector Modal
  const [inspectingSource, setInspectingSource] = useState<DataSourceMeta | null>(null);
  const [inspectedRecords, setInspectedRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(false);

  // Selected Anomaly Drawer
  const [selectedAnomaly, setSelectedAnomaly] = useState<DataQualityAnomaly | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDataFusionReport();
      setReport(data);
    } catch (err) {
      console.error('Failed to load data fusion report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleRevalidate = async () => {
    setIsRevalidating(true);
    try {
      const data = await forceRevalidateData();
      setReport(data);
      if (onRefreshState) onRefreshState();
    } catch (err) {
      console.error('Failed to revalidate data:', err);
    } finally {
      setIsRevalidating(false);
    }
  };

  const handleOpenSourceInspector = async (src: DataSourceMeta) => {
    setInspectingSource(src);
    setIsLoadingRecords(true);
    try {
      const data = await inspectSourceCollection(src.collection);
      setInspectedRecords(data.records || []);
    } catch (err) {
      console.error('Failed to inspect collection records:', err);
      setInspectedRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // Filtered anomalies
  const filteredAnomalies = (report?.anomalies || []).filter((a) => {
    const matchesSev = severityFilter === 'ALL' || a.severity === severityFilter;
    const matchesCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      a.rule_name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.record_id.toLowerCase().includes(q) ||
      a.collection.toLowerCase().includes(q);
    return matchesSev && matchesCat && matchesQuery;
  });

  return (
    <div className="w-full space-y-6 font-mono text-slate-100 select-none pb-8">
      {/* Top Header & Quality Score Card */}
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-wider text-white">
                  DATA FUSION & TRUST CENTRE
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-source data fusion, real-time schema validation, age tracking, and relational integrity across all 10 synthetic feeds.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 self-start md:self-auto">
          {/* Trust Score Indicator */}
          {report && (
            <div className="px-5 py-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-center shadow-inner">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Data Trust Index
              </div>
              <div className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                {report.overall_quality_score}%
              </div>
            </div>
          )}

          <button
            onClick={handleRevalidate}
            disabled={isRevalidating || isLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 text-white border border-cyan-400/40 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-950"
            title="Re-run comprehensive validation engine across all 10 datasets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRevalidating ? 'animate-spin' : ''}`} />
            <span>{isRevalidating ? 'VALIDATING...' : 'FORCE RE-VALIDATE'}</span>
          </button>
        </div>
      </div>

      {/* Synthetic Demonstration Notice Banner */}
      <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Synthetic Demonstration Data:</strong> All 10 dataset feeds represent synthetic operational models.
          </span>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono hidden sm:inline">
          Last Import: {report?.import_timestamp || '2026-10-07T06:00:00Z'}
        </span>
      </div>

      {/* Freshness & Quality Summary KPIs */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-400 uppercase">Total Records Evaluated</span>
            <div className="text-2xl font-black text-white">
              {report.summary_stats?.total_records_examined || 90}+ records
            </div>
            <span className="text-[10px] text-cyan-400">Across 10 unified collections</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-400 uppercase">Records In Spec</span>
            <div className="text-2xl font-black text-emerald-400">
              {report.summary_stats?.records_passing_validation ?? (report.sources.length * 8)}
            </div>
            <span className="text-[10px] text-emerald-500/80">Passing all relational constraints</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-400 uppercase">Fresh Feeds</span>
            <div className="text-2xl font-black text-cyan-300">
              {report.freshness_summary.fresh} / {report.sources.length}
            </div>
            <span className="text-[10px] text-cyan-400/80">Within freshness threshold</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-1 shadow-sm">
            <span className="text-[10px] text-slate-400 uppercase">Active Anomalies</span>
            <div className="text-2xl font-black text-rose-400">
              {report.anomalies.length} Issues
            </div>
            <span className="text-[10px] text-rose-400/80">
              {report.freshness_summary.critical_anomalies} Critical • {report.freshness_summary.warning_anomalies} Warnings
            </span>
          </div>
        </div>
      )}

      {/* Unified Ingested Data Sources Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-extrabold text-cyan-300 tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Unified Data Sources Inventory ({report?.sources.length || 0})</span>
          </h4>
          <span className="text-[10px] text-slate-400">
            Click any source to inspect raw records & provenance
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {report?.sources.map((src) => {
            const isFresh = src.freshness === 'FRESH';
            const isFailed = src.validation_status === 'FAILED';

            return (
              <div
                key={src.collection}
                onClick={() => handleOpenSourceInspector(src)}
                className="bg-slate-900/80 hover:bg-slate-800/80 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2.5 shadow-sm cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                      <span>{src.name}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400" />
                    </h5>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Collection: <span className="text-cyan-400">{src.collection}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                      isFresh
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {src.freshness}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Record Count:</span>
                  <span className="font-bold text-white">{src.record_count} items</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Threshold / Age:</span>
                  <span className="text-slate-300 font-mono">
                    {src.calculated_age_hours}h / {src.freshness_threshold_hours}h limit
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={`font-bold ${
                      isFailed ? 'text-rose-400' : src.detected_issues_count > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {src.detected_issues_count === 0
                      ? '✓ 0 Issues'
                      : `${src.detected_issues_count} Issue(s) Detected`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anomalies, Contradictions & Validation Alerts */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h4 className="text-xs uppercase font-extrabold text-rose-400 tracking-wider flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span>Active Contradictions & Validation Alerts ({filteredAnomalies.length})</span>
          </h4>

          {/* Search & Multi-Facet Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search rule, record, or feed..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-500 text-[10px] px-1.5">Severity:</span>
              {['ALL', 'CRITICAL', 'WARNING'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSeverityFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    severityFilter === lvl
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-500 text-[10px] px-1.5">Category:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'OPERATIONAL_CONFLICT', label: 'Conflicts' },
                { id: 'RELATIONAL_INTEGRITY', label: 'Relational' },
                { id: 'BUSINESS_RULE', label: 'Business' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredAnomalies.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white">No Contradictions Detected in Selected Filter</div>
            <p className="text-xs text-slate-400">
              All domain constraints, pilot fatigue margins, and relational foreign keys are consistent.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAnomalies.map((anom) => {
              const isCrit = anom.severity === 'CRITICAL';

              return (
                <div
                  key={anom.anomaly_id}
                  className={`p-4 rounded-xl border transition-all space-y-2 ${
                    isCrit
                      ? 'bg-rose-950/20 border-rose-600/40 hover:border-rose-500'
                      : 'bg-amber-950/20 border-amber-600/40 hover:border-amber-500'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                          isCrit
                            ? 'bg-rose-950 text-rose-300 border-rose-600'
                            : 'bg-amber-950 text-amber-300 border-amber-600'
                        }`}
                      >
                        {anom.severity}
                      </span>
                      <span className="font-bold text-xs text-white">{anom.rule_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Target Record: <strong className="text-cyan-300">{anom.record_id}</strong> ({anom.collection})
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {anom.category}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400">
                      Detected: {new Date(anom.detected_at).toLocaleTimeString()} IST
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-sans leading-relaxed">
                    {anom.description}
                  </p>

                  <div className="text-[11px] text-cyan-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                    <span>
                      <strong className="text-slate-400">Recommended Action:</strong> {anom.recommended_action}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Source Collection Raw Record Inspector Modal */}
      {inspectingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-4xl max-h-[85vh] rounded-2xl border border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-cyan-400" />
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    {inspectingSource.name} ({inspectingSource.collection})
                  </h4>
                  <p className="text-[10px] text-slate-400 font-sans">
                    {inspectingSource.provenance} • Schema Version: {inspectingSource.schema_version}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingSource(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Record Count</span>
                  <strong className="text-white font-mono">{inspectedRecords.length} items</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Freshness</span>
                  <strong className="text-emerald-400 font-mono">{inspectingSource.freshness}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Threshold</span>
                  <strong className="text-cyan-300 font-mono">{inspectingSource.freshness_threshold_hours} hours</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Timestamps</span>
                  <strong className="text-slate-300 font-mono">
                    {inspectingSource.record_level_timestamps ? 'Record-Level' : 'Dataset-Level Only'}
                  </strong>
                </div>
              </div>

              {isLoadingRecords ? (
                <div className="py-12 text-center text-cyan-400 space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
                  <p>Loading raw collection records from state store...</p>
                </div>
              ) : inspectedRecords.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No records found in this collection.</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Raw Records Payload ({inspectedRecords.length})
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-[50vh] leading-relaxed">
                    {JSON.stringify(inspectedRecords, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setInspectingSource(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
