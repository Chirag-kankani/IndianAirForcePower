import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Search,
  Plus,
  SlidersHorizontal,
  Layers,
  Fuel,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  X,
  History,
  Plane,
  Building2,
  Calendar,
  User,
  FileText,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  fetchMaintenanceRecords,
  fetchMaintenanceSummary,
  createMaintenanceRecord,
  updateMaintenanceStatus,
  fetchAircraftMaintenanceHistory,
  fetchSupportInventory,
  adjustInventory,
} from '../services/api';
import type {
  MaintenanceRecord,
  SupportInventory,
  MaintenanceSummary,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  Aircraft,
  Airbase,
} from '../types';

interface MaintenanceLogisticsPanelProps {
  onRefreshState?: () => void;
  aircraftList?: Aircraft[];
  airbaseList?: Airbase[];
}

export const MaintenanceLogisticsPanel: React.FC<MaintenanceLogisticsPanelProps> = ({
  onRefreshState,
  aircraftList = [],
  airbaseList = [],
}) => {
  const [subTab, setSubTab] = useState<'WORK_ORDERS' | 'ASSET_HISTORY' | 'INVENTORY'>('WORK_ORDERS');

  // Work Orders state
  const [workOrders, setWorkOrders] = useState<MaintenanceRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [woStatusFilter, setWoStatusFilter] = useState<string>('ALL');
  const [woAirbaseFilter, setWoAirbaseFilter] = useState<string>('ALL');
  const [woPriorityFilter, setWoPriorityFilter] = useState<string>('ALL');
  const [woSearch, setWoSearch] = useState('');
  const [isUpdatingWo, setIsUpdatingWo] = useState<string | null>(null);

  // Selected Work Order for Detail Drawer
  const [selectedWo, setSelectedWo] = useState<MaintenanceRecord | null>(null);

  // New Work Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWoForm, setNewWoForm] = useState({
    resource_id: aircraftList[0]?.aircraft_id || 'AC_RAFALE_01',
    airbase_id: airbaseList[0]?.id || 'BASE_TRISHUL',
    category: 'SCHEDULED_INSPECTION' as MaintenanceCategory,
    priority: 'MEDIUM' as MaintenancePriority,
    planned_start: new Date().toISOString().slice(0, 16),
    planned_completion: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    estimated_duration_hours: 12,
    description: '',
    technician_lead: 'Master Warrant Officer P. Deshmukh',
    selected_part_id: '',
    selected_part_qty: 1,
  });

  // Asset History state
  const [selectedHistoryAircraft, setSelectedHistoryAircraft] = useState<string>(
    aircraftList[0]?.aircraft_id || 'AC_RAFALE_04'
  );
  const [aircraftHistory, setAircraftHistory] = useState<any | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<SupportInventory[]>([]);
  const [invCategoryFilter, setInvCategoryFilter] = useState<string>('ALL');
  const [invAirbaseFilter, setInvAirbaseFilter] = useState<string>('ALL');
  const [invSearch, setInvSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<SupportInventory | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(1);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  const loadData = async () => {
    try {
      const [wos, inv, sum] = await Promise.all([
        fetchMaintenanceRecords(),
        fetchSupportInventory(),
        fetchMaintenanceSummary(),
      ]);
      setWorkOrders(wos);
      setInventoryItems(inv);
      setSummary(sum);
    } catch (err) {
      console.error('Error loading maintenance data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadAssetHistory = async (acId: string) => {
    if (!acId) return;
    setIsLoadingHistory(true);
    try {
      const data = await fetchAircraftMaintenanceHistory(acId);
      setAircraftHistory(data);
    } catch (err) {
      console.error('Error loading aircraft maintenance history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (subTab === 'ASSET_HISTORY' && selectedHistoryAircraft) {
      loadAssetHistory(selectedHistoryAircraft);
    }
  }, [subTab, selectedHistoryAircraft]);

  // Action: Update Work Order status
  const handleUpdateStatus = async (woId: string, nextStatus: MaintenanceStatus) => {
    setIsUpdatingWo(woId);
    try {
      await updateMaintenanceStatus(woId, nextStatus);
      await loadData();
      if (selectedWo && selectedWo.record_id === woId) {
        setSelectedWo((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      alert(`Error updating work order: ${err.message}`);
    } finally {
      setIsUpdatingWo(null);
    }
  };

  // Action: Create Work Order
  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWoForm.description.trim()) {
      alert('Please provide a task description.');
      return;
    }

    const requiredParts = newWoForm.selected_part_id
      ? [
          {
            item_id: newWoForm.selected_part_id,
            quantity_needed: Number(newWoForm.selected_part_qty) || 1,
          },
        ]
      : [];

    try {
      await createMaintenanceRecord({
        resource_id: newWoForm.resource_id,
        resource_type: 'AIRCRAFT',
        category: newWoForm.category,
        priority: newWoForm.priority,
        airbase_id: newWoForm.airbase_id,
        planned_start: new Date(newWoForm.planned_start).toISOString(),
        planned_completion: new Date(newWoForm.planned_completion).toISOString(),
        estimated_duration_hours: Number(newWoForm.estimated_duration_hours),
        description: newWoForm.description,
        technician_lead: newWoForm.technician_lead,
        required_parts: requiredParts,
      });

      setShowCreateModal(false);
      setNewWoForm({
        ...newWoForm,
        description: '',
        selected_part_id: '',
      });
      await loadData();
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      alert(`Failed to create work order: ${err.message}`);
    }
  };

  // Action: Adjust Inventory
  const handleConfirmAdjust = async () => {
    if (!adjustingItem) return;
    try {
      await adjustInventory(
        adjustingItem.item_id,
        adjustmentAmount,
        adjustmentReason || 'Routine depot replenishment adjustment'
      );
      setAdjustingItem(null);
      setAdjustmentReason('');
      await loadData();
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      alert(`Error adjusting stock: ${err.message}`);
    }
  };

  // Filtered Work Orders
  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesStatus = woStatusFilter === 'ALL' || wo.status === woStatusFilter;
    const matchesBase = woAirbaseFilter === 'ALL' || wo.airbase_id === woAirbaseFilter;
    const matchesPri = woPriorityFilter === 'ALL' || wo.priority === woPriorityFilter;
    const term = woSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      wo.record_id.toLowerCase().includes(term) ||
      wo.resource_id.toLowerCase().includes(term) ||
      wo.description.toLowerCase().includes(term) ||
      wo.technician_lead.toLowerCase().includes(term);
    return matchesStatus && matchesBase && matchesPri && matchesSearch;
  });

  // Filtered Inventory
  const filteredInventory = inventoryItems.filter((item) => {
    const matchesCat = invCategoryFilter === 'ALL' || item.category === invCategoryFilter;
    const matchesBase = invAirbaseFilter === 'ALL' || item.airbase_id === invAirbaseFilter;
    const matchesLowStock = !lowStockOnly || item.quantity_on_hand <= item.reorder_threshold;
    const term = invSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.item_id.toLowerCase().includes(term) ||
      item.item_name.toLowerCase().includes(term) ||
      item.airbase_id.toLowerCase().includes(term);
    return matchesCat && matchesBase && matchesLowStock && matchesSearch;
  });

  return (
    <div className="w-full space-y-6 font-mono text-slate-100 select-none pb-8">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black tracking-wider text-white">
                MAINTENANCE & LOGISTICS CENTRE
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                MRO DEPOT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Technical work orders, turn-around scheduling, component supply chain, and ground support equipment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-tab Navigation */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            <button
              onClick={() => setSubTab('WORK_ORDERS')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                subTab === 'WORK_ORDERS'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Work Orders ({workOrders.length})</span>
            </button>
            <button
              onClick={() => setSubTab('ASSET_HISTORY')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                subTab === 'ASSET_HISTORY'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Asset MRO History</span>
            </button>
            <button
              onClick={() => setSubTab('INVENTORY')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                subTab === 'INVENTORY'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Spares & GSE ({inventoryItems.length})</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-950 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">NEW WORK ORDER</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase">Active Workload</span>
          <div className="text-xl font-black text-cyan-300">
            {(summary?.scheduled_open || 0) + (summary?.in_progress || 0)} Orders
          </div>
          <span className="text-[10px] text-slate-500">Scheduled & In Depot</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase">In Progress</span>
          <div className="text-xl font-black text-amber-300">
            {summary?.in_progress ?? workOrders.filter((w) => w.status === 'IN_PROGRESS').length} Bays
          </div>
          <span className="text-[10px] text-amber-400/80">Active hangar work</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase">Overdue Tasks</span>
          <div className="text-xl font-black text-rose-400">
            {summary?.overdue ?? workOrders.filter((w) => w.status === 'OVERDUE').length} Tasks
          </div>
          <span className="text-[10px] text-rose-400/80">Exceeded planned completion</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase">Completed Cycle</span>
          <div className="text-xl font-black text-emerald-400">
            {summary?.completed ?? workOrders.filter((w) => w.status === 'COMPLETED').length} Signed Off
          </div>
          <span className="text-[10px] text-emerald-400/80">Returned to flight line</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase">Critical Low Spares</span>
          <div className="text-xl font-black text-rose-300">
            {summary?.critical_reorder_count ?? inventoryItems.filter((i) => i.quantity_on_hand <= 1).length} Items
          </div>
          <span className="text-[10px] text-rose-400/80">Stock ≤ 1 unit</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase">Blocked by Shortage</span>
          <div className="text-xl font-black text-amber-400">
            {summary?.blocked_work_orders_count || 1} Work Orders
          </div>
          <span className="text-[10px] text-amber-400/80">Awaiting LRU delivery</span>
        </div>
      </div>

      {/* ─── SUB-TAB 1: WORK ORDERS TABLE ─────────────────────────────────── */}
      {subTab === 'WORK_ORDERS' && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search work order ID, airframe, description..."
                  value={woSearch}
                  onChange={(e) => setWoSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Status Filter */}
              <select
                value={woStatusFilter}
                onChange={(e) => setWoStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Scheduled (Open)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="OVERDUE">Overdue</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Airbase Filter */}
              <select
                value={woAirbaseFilter}
                onChange={(e) => setWoAirbaseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer hidden sm:block"
              >
                <option value="ALL">All Airbases</option>
                {airbaseList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[11px] text-slate-400">
              Showing <strong>{filteredWorkOrders.length}</strong> of {workOrders.length} work orders
            </span>
          </div>

          {/* Work Orders Table */}
          <div className="glass-panel rounded-2xl border border-cyan-500/20 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Order ID & Asset</th>
                    <th className="py-3 px-4">Category & Priority</th>
                    <th className="py-3 px-4">Station Airbase</th>
                    <th className="py-3 px-4">Task Description</th>
                    <th className="py-3 px-4">Schedule Timeline</th>
                    <th className="py-3 px-4">Status & Spares</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No work orders match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkOrders.map((wo) => {
                      const isOverdue = wo.status === 'OVERDUE';
                      const isInProg = wo.status === 'IN_PROGRESS';
                      const isCompleted = wo.status === 'COMPLETED';

                      return (
                        <tr
                          key={wo.record_id}
                          className="hover:bg-slate-850/60 transition-colors cursor-pointer group"
                          onClick={() => setSelectedWo(wo)}
                        >
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-cyan-300 group-hover:text-cyan-200">
                              {wo.record_id}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Plane className="w-3 h-3 text-cyan-400" />
                              <strong className="text-white">{wo.resource_id}</strong>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">
                              {wo.category.replace(/_/g, ' ')}
                            </div>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border inline-block mt-0.5 ${
                                wo.priority === 'CRITICAL'
                                  ? 'bg-rose-950 text-rose-300 border-rose-600'
                                  : wo.priority === 'HIGH'
                                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {wo.priority}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-300">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{wo.airbase_id.replace('BASE_', '')}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs font-sans text-slate-300 text-xs truncate">
                            {wo.description}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-300">
                            <div>Est: {wo.estimated_duration_hours}h</div>
                            <div className="text-[10px] text-slate-500">
                              Due: {new Date(wo.planned_completion).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border inline-block ${
                                isOverdue
                                  ? 'bg-rose-950 text-rose-300 border-rose-600'
                                  : isInProg
                                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                                  : isCompleted
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {wo.status}
                            </span>
                            {wo.required_parts && wo.required_parts.length > 0 && (
                              <div className="text-[9px] text-cyan-400 mt-1">
                                {wo.required_parts.length} part(s) linked
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {wo.status === 'OPEN' && (
                                <button
                                  onClick={() => handleUpdateStatus(wo.record_id, 'IN_PROGRESS')}
                                  disabled={isUpdatingWo === wo.record_id}
                                  className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold cursor-pointer"
                                  title="Mark Work In Progress"
                                >
                                  START WORK
                                </button>
                              )}
                              {(wo.status === 'IN_PROGRESS' || wo.status === 'OVERDUE') && (
                                <button
                                  onClick={() => handleUpdateStatus(wo.record_id, 'COMPLETED')}
                                  disabled={isUpdatingWo === wo.record_id}
                                  className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer"
                                  title="Complete and Return to Service"
                                >
                                  COMPLETE
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedWo(wo)}
                                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                title="Inspect Details"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-TAB 2: ASSET-LEVEL MAINTENANCE HISTORY ──────────────────── */}
      {subTab === 'ASSET_HISTORY' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white uppercase">Select Airframe:</span>
              <select
                value={selectedHistoryAircraft}
                onChange={(e) => setSelectedHistoryAircraft(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {aircraftList.map((ac) => (
                  <option key={ac.aircraft_id} value={ac.aircraft_id}>
                    {ac.callsign} ({ac.model}) — {ac.status}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[11px] text-slate-400">
              Showing historical depot inspections, defect logs, and lifecycle events.
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 text-center text-cyan-400 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
              <p>Fetching asset maintenance history...</p>
            </div>
          ) : !aircraftHistory ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
              Select an aircraft above to inspect its maintenance logs.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Airframe Technical Card */}
              <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-white text-sm">
                    {aircraftHistory.aircraft.callsign}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-cyan-950 text-cyan-300 border border-cyan-600">
                    {aircraftHistory.aircraft.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Model:</span>
                    <strong className="text-white">{aircraftHistory.aircraft.model}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Home Base:</span>
                    <span className="text-slate-200">{aircraftHistory.aircraft.home_base_id}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Fuel:</span>
                    <span className="text-amber-300">{aircraftHistory.aircraft.current_fuel_pct}%</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Turnaround Time:</span>
                    <span className="text-slate-200">{aircraftHistory.aircraft.turnaround_time_mins} mins</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Recorded Work Orders:</span>
                    <strong className="text-cyan-400">{aircraftHistory.total_maintenance_cycles} cycles</strong>
                  </div>
                </div>
              </div>

              {/* Maintenance Timeline */}
              <div className="lg:col-span-2 space-y-3">
                <h4 className="text-xs uppercase font-extrabold text-cyan-300 tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-cyan-400" />
                  <span>Work Order Log for {aircraftHistory.aircraft.aircraft_id}</span>
                </h4>

                {aircraftHistory.work_orders.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                    No historical work orders recorded for this airframe.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {aircraftHistory.work_orders.map((wo: any) => (
                      <div
                        key={wo.record_id}
                        className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                          <div className="flex items-center gap-2">
                            <strong className="text-cyan-300">{wo.record_id}</strong>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {wo.category.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {wo.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-sans">{wo.description}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                          <span>Lead: {wo.technician_lead}</span>
                          <span>
                            Est: {wo.estimated_duration_hours}h | Act:{' '}
                            {wo.actual_duration_hours ? `${wo.actual_duration_hours}h` : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-TAB 3: SUPPORT INVENTORY & SPARES ────────────────────────── */}
      {subTab === 'INVENTORY' && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search spare parts, equipment..."
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Category Filter */}
              <select
                value={invCategoryFilter}
                onChange={(e) => setInvCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="PROPULSION_SPARE">Turbofan / Engines</option>
                <option value="AVIONICS_LRU">Avionics & Radars</option>
                <option value="HYDRAULIC_FLUID">Hydraulic Fluids</option>
                <option value="OXYGEN_CANISTER">Aviation LOX Canisters</option>
                <option value="GROUND_SUPPORT_EQUIPMENT">Ground Support (GSE)</option>
                <option value="MUNITION_COMPONENT">Munitions Components</option>
              </select>

              {/* Low Stock Toggle */}
              <button
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  lowStockOnly
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Only</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              Showing <strong>{filteredInventory.length}</strong> items
            </span>
          </div>

          {/* Inventory Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredInventory.map((item) => {
              const isCrit = item.quantity_on_hand <= 1 && item.reorder_threshold > 1;
              const isLow = item.quantity_on_hand <= item.reorder_threshold;

              return (
                <div
                  key={item.item_id}
                  className={`bg-slate-900/85 p-4 rounded-xl border transition-all space-y-2.5 shadow-sm ${
                    isCrit
                      ? 'border-rose-600/40 bg-rose-950/10'
                      : isLow
                      ? 'border-amber-600/40 bg-amber-950/10'
                      : 'border-slate-800 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-xs text-white leading-snug">{item.item_name}</h5>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.item_id} • {item.airbase_id.replace('BASE_', '')}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                        isCrit
                          ? 'bg-rose-950 text-rose-300 border-rose-600'
                          : isLow
                          ? 'bg-amber-950 text-amber-300 border-amber-600'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {/* Quantity Indicator */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">On Hand:</span>
                      <strong className="text-white">
                        {item.quantity_on_hand} {item.unit}
                      </strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isCrit ? 'bg-rose-500' : isLow ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (item.quantity_on_hand / Math.max(1, item.reorder_threshold * 2)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Reorder Trigger: {item.reorder_threshold} {item.unit}</span>
                    <span>Lead Time: {item.supplier_lead_time_days} days</span>
                  </div>

                  <button
                    onClick={() => {
                      setAdjustingItem(item);
                      setAdjustmentAmount(1);
                      setAdjustmentReason('Stock intake from central depot');
                    }}
                    className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-bold text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>ADJUST STOCK</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: WORK ORDER DETAIL DRAWER ────────────────────────────── */}
      {selectedWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-cyan-500/40 shadow-2xl overflow-hidden text-xs space-y-4 p-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider">
                  MRO Work Order Details
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  {selectedWo.record_id} — {selectedWo.resource_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWo(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Category</span>
                <strong className="text-white">{selectedWo.category.replace(/_/g, ' ')}</strong>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Priority</span>
                <strong className="text-amber-400">{selectedWo.priority}</strong>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Station Airbase</span>
                <strong className="text-slate-200">{selectedWo.airbase_id}</strong>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Duration</span>
                <strong className="text-cyan-300">
                  {selectedWo.estimated_duration_hours}h estimated{' '}
                  {selectedWo.actual_duration_hours ? `(${selectedWo.actual_duration_hours}h actual)` : ''}
                </strong>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase mb-1">Task Description</span>
              <p className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-slate-200 font-sans leading-relaxed">
                {selectedWo.description}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span>Technician Lead: <strong className="text-white">{selectedWo.technician_lead}</strong></span>
              <span>Status: <strong className="text-cyan-300">{selectedWo.status}</strong></span>
            </div>

            {/* Lifecycle Transition Actions */}
            <div className="flex justify-end gap-2 pt-2">
              {selectedWo.status === 'OPEN' && (
                <button
                  onClick={() => handleUpdateStatus(selectedWo.record_id, 'IN_PROGRESS')}
                  className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg cursor-pointer hover:bg-amber-400"
                >
                  START DEPOT WORK
                </button>
              )}
              {(selectedWo.status === 'IN_PROGRESS' || selectedWo.status === 'OVERDUE') && (
                <button
                  onClick={() => handleUpdateStatus(selectedWo.record_id, 'COMPLETED')}
                  className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg cursor-pointer hover:bg-emerald-400"
                >
                  SIGN OFF & COMPLETE
                </button>
              )}
              <button
                onClick={() => setSelectedWo(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg cursor-pointer hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: NEW WORK ORDER CREATION ─────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateWorkOrder}
            className="glass-panel w-full max-w-xl rounded-2xl border border-cyan-500/40 shadow-2xl p-6 text-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-extrabold text-white">Schedule New Work Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Aircraft</label>
                <select
                  value={newWoForm.resource_id}
                  onChange={(e) => setNewWoForm({ ...newWoForm, resource_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {aircraftList.map((ac) => (
                    <option key={ac.aircraft_id} value={ac.aircraft_id}>
                      {ac.callsign} ({ac.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Station Airbase</label>
                <select
                  value={newWoForm.airbase_id}
                  onChange={(e) => setNewWoForm({ ...newWoForm, airbase_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {airbaseList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Category</label>
                <select
                  value={newWoForm.category}
                  onChange={(e) => setNewWoForm({ ...newWoForm, category: e.target.value as MaintenanceCategory })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="SCHEDULED_INSPECTION">Scheduled Inspection</option>
                  <option value="AVIONICS_REPAIR">Avionics Repair</option>
                  <option value="ENGINE_OVERHAUL">Engine Overhaul</option>
                  <option value="HYDRAULIC_SERVICE">Hydraulic Service</option>
                  <option value="AIRFRAME_STRUCTURAL">Airframe Structural</option>
                  <option value="UNSCHEDULED_FAULT">Unscheduled Fault</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Priority</label>
                <select
                  value={newWoForm.priority}
                  onChange={(e) => setNewWoForm({ ...newWoForm, priority: e.target.value as MaintenancePriority })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Task Description</label>
              <textarea
                required
                rows={3}
                placeholder="Detailed technical inspection or component replacement scope..."
                value={newWoForm.description}
                onChange={(e) => setNewWoForm({ ...newWoForm, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Est. Duration (Hours)</label>
                <input
                  type="number"
                  min={1}
                  value={newWoForm.estimated_duration_hours}
                  onChange={(e) => setNewWoForm({ ...newWoForm, estimated_duration_hours: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Technician Lead</label>
                <input
                  type="text"
                  value={newWoForm.technician_lead}
                  onChange={(e) => setNewWoForm({ ...newWoForm, technician_lead: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold rounded-lg cursor-pointer shadow-lg"
              >
                SUBMIT WORK ORDER
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL 3: INVENTORY ADJUSTMENT ────────────────────────────────── */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 shadow-2xl p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-cyan-400 uppercase font-bold">Depot Inventory Adjustment</span>
                <h4 className="text-sm font-extrabold text-white mt-0.5">{adjustingItem.item_name}</h4>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Current On Hand:</span>
                <strong className="text-white">{adjustingItem.quantity_on_hand} {adjustingItem.unit}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Reserved Quantity:</span>
                <span className="text-amber-400">{adjustingItem.reserved_quantity} {adjustingItem.unit}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Station Airbase:</span>
                <span className="text-slate-200">{adjustingItem.airbase_id}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Stock Change Quantity (+/-)
              </label>
              <input
                type="number"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Resulting stock: {adjustingItem.quantity_on_hand + adjustmentAmount} {adjustingItem.unit}
              </span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Audit Rationale</label>
              <input
                type="text"
                placeholder="Reason for adjustment (e.g. Depot restock, calibration intake)..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setAdjustingItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjust}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg cursor-pointer shadow-md"
              >
                CONFIRM ADJUSTMENT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
