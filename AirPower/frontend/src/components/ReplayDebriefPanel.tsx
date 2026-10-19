import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  Plane,
  ArrowRight,
  FileText,
  RefreshCw,
  Eye,
  Activity,
  Sparkles,
  Plus,
  Map as MapIcon,
  LayoutGrid,
  Zap,
  Info,
  ChevronRight,
  Radio,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ReplaySessionSummary,
  ReplaySession,
  ReplayStep,
  DebriefReport,
} from '../types';
import {
  fetchReplaySessions,
  fetchReplaySession,
  fetchDebriefReport,
  startNewReplaySession,
  deleteReplaySession,
  clearAllReplaySessions,
} from '../services/api';
import { TacticalMap } from './TacticalMap';

interface ReplayDebriefPanelProps {
  onNavigateToMap: () => void;
  onNavigateToDashboard: () => void;
}

export const ReplayDebriefPanel: React.FC<ReplayDebriefPanelProps> = ({
  onNavigateToMap,
  onNavigateToDashboard,
}) => {
  // Navigation & Sessions State
  const [sessions, setSessions] = useState<ReplaySessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<ReplaySession | null>(null);
  const [debriefReport, setDebriefReport] = useState<DebriefReport | null>(null);
  const [activeTab, setActiveTab] = useState<'REPLAY' | 'DEBRIEF'>('REPLAY');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStartingNew, setIsStartingNew] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Playback Control State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [inspectorView, setInspectorView] = useState<'MAP' | 'FLEET' | 'INCIDENTS' | 'DELTA'>('MAP');

  const playTimerRef = useRef<any>(null);

  // 1. Fetch Session List on mount
  const loadSessions = useCallback(async (autoSelectLatest = false, targetId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchReplaySessions();
      setSessions(data);
      if (data.length > 0) {
        let chosenId = targetId || selectedSessionId;
        if (!chosenId || autoSelectLatest || !data.some((s) => s.session_id === chosenId)) {
          chosenId = data[0].session_id;
        }
        setSelectedSessionId(chosenId);
      } else {
        setSelectedSessionId('');
        setCurrentSession(null);
        setDebriefReport(null);
      }
    } catch (err: any) {
      console.error('Failed to load replay sessions:', err);
      setError(err?.message || 'Failed to load replay sessions');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadSessions(true);
  }, []);

  // 2. Load Session Details & Debrief Report when selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return;

    let isMounted = true;
    const loadSessionData = async () => {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      try {
        const [sessionData, debriefData] = await Promise.all([
          fetchReplaySession(selectedSessionId),
          fetchDebriefReport(selectedSessionId),
        ]);
        if (isMounted) {
          setCurrentSession(sessionData);
          setDebriefReport(debriefData);
          setCurrentStepIndex(0);
        }
      } catch (err: any) {
        console.error('Failed to load session details:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to load session data');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSessionData();
    return () => {
      isMounted = false;
    };
  }, [selectedSessionId]);

  // 3. Playback Loop
  const totalSteps = currentSession?.steps?.length || 0;
  const currentStep: ReplayStep | null = useMemo(() => {
    if (!currentSession || !currentSession.steps || currentSession.steps.length === 0) return null;
    return currentSession.steps[currentStepIndex] || currentSession.steps[0];
  }, [currentSession, currentStepIndex]);

  useEffect(() => {
    if (isPlaying && totalSteps > 1) {
      const intervalMs = Math.max(600, 2400 / playbackSpeed);
      playTimerRef.current = setTimeout(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentStepIndex, totalSteps, playbackSpeed]);

  // 4. Keyboard Shortcuts for Playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex((prev) => Math.max(0, prev - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
      } else if (e.code === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex(totalSteps - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSteps]);

  // Handle starting a new recording session
  const handleStartNewSession = async () => {
    const name = window.prompt(
      'Enter Scenario Name for New Recording Session:',
      `Air Defence Simulation - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    if (!name) return;

    setIsStartingNew(true);
    try {
      const created = await startNewReplaySession(name);
      await loadSessions(false, created.session_id);
      setSelectedSessionId(created.session_id);
    } catch (err: any) {
      alert(`Failed to start new session: ${err?.message || 'Server error'}`);
    } finally {
      setIsStartingNew(false);
    }
  };

  // Handle deleting the current replay session
  const handleDeleteCurrentSession = async () => {
    if (!selectedSessionId) return;
    setIsDeleting(true);
    try {
      await deleteReplaySession(selectedSessionId);
      setShowDeleteModal(false);
      setDeleteNotice(`Replay session ${selectedSessionId} permanently deleted from data.`);
      setTimeout(() => setDeleteNotice(null), 4000);
      await loadSessions(true);
    } catch (err: any) {
      alert(`Failed to delete session: ${err?.message || 'Server error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle clearing all replay sessions
  const handleClearAllSessions = async (keepDemo: boolean = false) => {
    setIsDeleting(true);
    try {
      await clearAllReplaySessions(keepDemo);
      setShowDeleteModal(false);
      setDeleteNotice(
        keepDemo
          ? 'Cleared recording sessions and restored reference demo.'
          : 'All replay sessions permanently purged from persistent data.'
      );
      setTimeout(() => setDeleteNotice(null), 4000);
      await loadSessions(true);
    } catch (err: any) {
      alert(`Failed to clear sessions: ${err?.message || 'Server error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export JSON debrief report
  const handleExportJSON = () => {
    if (!debriefReport) return;
    const jsonStr = JSON.stringify(debriefReport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debrief-${debriefReport.session_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format elapsed seconds into mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'WARNING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'INFRASTRUCTURE':
        return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
      case 'THREAT':
        return 'text-red-400 border-red-500/30 bg-red-950/40';
      case 'AIRCRAFT_FAULT':
        return 'text-rose-400 border-rose-500/30 bg-rose-950/40';
      case 'SORTIE':
        return 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
      case 'MAINTENANCE':
        return 'text-purple-400 border-purple-500/30 bg-purple-950/40';
      default:
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100 font-sans select-none print:h-auto print:overflow-visible print:bg-white print:text-black">
      {/* ------------------------------------------------------------------- */}
      {/* 1. TOP HEADER & SESSION SELECTOR BAR                                */}
      {/* ------------------------------------------------------------------- */}
      <div className="h-14 px-4 border-b border-cyan-500/20 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 gap-3 z-20 print:hidden">
        {/* Left: Title & Session Selector Dropdown */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <RotateCcw className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider font-mono text-white flex items-center gap-2">
                EVENT REPLAY & DEBRIEF
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest font-mono">
                  DETERMINISTIC
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono hidden md:block">
                Historical State Isolation & Post-Scenario After-Action Review
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700/60 mx-1 hidden sm:block" />

          {/* Session Selector */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider hidden sm:inline">
              Session:
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-cyan-300 focus:outline-none focus:border-cyan-400 shadow-inner max-w-[240px] sm:max-w-[320px] truncate"
            >
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.scenario_name} ({s.event_count} ev, {formatTime(s.duration_seconds)})
                </option>
              ))}
            </select>

            <button
              onClick={() => loadSessions(false)}
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 bg-slate-950/60 transition-all cursor-pointer"
              title="Refresh Sessions"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleStartNewSession}
              disabled={isStartingNew}
              className="px-2.5 py-1 rounded-lg border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 bg-cyan-950/40 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer font-bold shrink-0"
              title="Start New Scenario Recording"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">NEW RECORDING</span>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={!selectedSessionId || sessions.length === 0}
              className="px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 bg-rose-950/40 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer font-bold shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete Replay Session(s) from persistent data storage"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden lg:inline">DELETE REPLAY</span>
            </button>
          </div>
        </div>

        {/* Right: Mode Switcher (REPLAY vs DEBRIEF) & Navigation Links */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="inline-flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('REPLAY')}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all font-bold cursor-pointer ${
                activeTab === 'REPLAY'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span>REPLAY TIMELINE</span>
            </button>

            <button
              onClick={() => setActiveTab('DEBRIEF')}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all font-bold cursor-pointer ${
                activeTab === 'DEBRIEF'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>DEBRIEF REPORT</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-700/60 mx-1 hidden sm:block" />

          <button
            onClick={onNavigateToMap}
            className="px-2.5 py-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all cursor-pointer hidden md:flex items-center gap-1"
          >
            <span>LIVE MAP</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* State Isolation Security Notice Banner */}
      <div className="px-4 py-1.5 bg-cyan-950/40 border-b border-cyan-500/30 flex items-center justify-between text-xs font-mono text-cyan-300 z-10 shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            <strong className="text-white">HISTORICAL REPLAY MODE:</strong> Complete snapshot isolation. Playback does NOT modify live operational state.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>Active Session ID: <span className="text-cyan-200">{selectedSessionId || 'NONE'}</span></span>
          <span className="hidden sm:inline">Status: <span className="text-emerald-300 font-bold">{currentSession?.status || 'N/A'}</span></span>
        </div>
      </div>

      {/* Delete / Operation Notice Banner */}
      {deleteNotice && (
        <div className="px-4 py-2 bg-rose-950/90 border-b border-rose-500/60 flex items-center justify-between text-xs font-mono text-rose-200 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{deleteNotice}</span>
          </div>
          <button
            onClick={() => setDeleteNotice(null)}
            className="p-1 hover:text-white text-rose-300 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center font-mono">
          <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
          <p className="text-sm text-cyan-300 tracking-wider">RECONSTRUCTING HISTORICAL SIMULATION SNAPSHOTS...</p>
          <p className="text-xs text-slate-500 mt-1">Reading deterministic state checkpoints from disk repository</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center font-mono">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
          <p className="text-sm text-amber-300 tracking-wider font-bold">UNABLE TO LOAD REPLAY SESSION</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">{error}</p>
          <button
            onClick={() => loadSessions(true)}
            className="mt-4 px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-all cursor-pointer"
          >
            RETRY LOADING
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center font-mono space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center text-slate-500 shadow-xl">
            <RotateCcw className="w-8 h-8 text-slate-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200 tracking-wider">NO REPLAY SESSIONS RECORDED</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              All previous replay recordings have been deleted from disk data storage. You can start recording a live scenario or restore the built-in reference demo.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleStartNewSession}
              disabled={isStartingNew}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-200 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.3)]"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              START NEW RECORDING
            </button>
            <button
              onClick={() => handleClearAllSessions(true)}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              RESTORE REFERENCE DEMO
            </button>
          </div>
        </div>
      ) : activeTab === 'REPLAY' ? (
        /* ------------------------------------------------------------------- */
        /* 2. REPLAY TIMELINE MODE                                             */
        /* ------------------------------------------------------------------- */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Upper Section: Split Map/Fleet Inspector & Event Details */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left / Center: Historical State Inspector */}
            <div className="flex-1 flex flex-col border-r border-slate-800/80 overflow-hidden relative">
              {/* Sub-view Switcher Bar above State Inspector */}
              <div className="h-10 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px] uppercase tracking-wider mr-2">Inspector:</span>
                  <button
                    onClick={() => setInspectorView('MAP')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                      inspectorView === 'MAP'
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>TACTICAL MAP</span>
                  </button>

                  <button
                    onClick={() => setInspectorView('FLEET')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                      inspectorView === 'FLEET'
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5" />
                    <span>FLEET & BASES</span>
                  </button>

                  <button
                    onClick={() => setInspectorView('INCIDENTS')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                      inspectorView === 'INCIDENTS'
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>INCIDENT CHRONOLOGY</span>
                  </button>

                  <button
                    onClick={() => setInspectorView('DELTA')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                      inspectorView === 'DELTA'
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>STEP DELTA</span>
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span>Step: <strong className="text-cyan-300">{currentStepIndex + 1}</strong> of {totalSteps}</span>
                  <span>T+ <strong className="text-white">{formatTime(currentStep?.elapsed_seconds || 0)}</strong></span>
                </div>
              </div>

              {/* Inspector Content */}
              <div className="flex-1 relative overflow-hidden bg-slate-950">
                {currentStep ? (
                  inspectorView === 'MAP' ? (
                    <div className="w-full h-full relative">
                      {/* Read-only Tactical Map with Current Snapshot */}
                      <TacticalMap
                        airbases={currentStep.state_snapshot.airbases}
                        threats={currentStep.state_snapshot.threat_environment}
                        targets={currentStep.state_snapshot.mission_targets}
                        activeMissions={currentStep.state_snapshot.active_missions}
                        selectedPackage={null}
                        selectedTargetId={null}
                        onSelectTarget={() => {}}
                        onMapClickTarget={() => {}}
                        activeAlertMessage={`${currentStep.title} — ${currentStep.description}`}
                      />
                      {/* Floating Step Watermark */}
                      <div className="absolute top-4 left-4 z-[400] glass-panel px-3 py-1.5 rounded-lg border border-cyan-500/40 font-mono text-xs shadow-xl pointer-events-none">
                        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
                          STEP {currentStepIndex + 1}: {currentStep.category}
                        </div>
                        <div className="text-white font-bold">{currentStep.title}</div>
                      </div>
                    </div>
                  ) : inspectorView === 'FLEET' ? (
                    <div className="w-full h-full overflow-y-auto p-4 space-y-4 font-mono text-xs">
                      {/* Aircraft Fleet State Grid */}
                      <div>
                        <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Plane className="w-4 h-4 text-cyan-400" />
                          Aircraft Fleet Status at T+{formatTime(currentStep.elapsed_seconds)} ({currentStep.state_snapshot.aircraft_fleet.length} Units)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {currentStep.state_snapshot.aircraft_fleet.map((ac) => {
                            const isAffected = currentStep.affected_entity_ids.includes(ac.aircraft_id);
                            return (
                              <div
                                key={ac.aircraft_id}
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isAffected
                                    ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                    : 'bg-slate-900/60 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-white">{ac.callsign}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      ac.status === 'READY'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : ac.status === 'AIRBORNE'
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    }`}
                                  >
                                    {ac.status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 space-y-0.5">
                                  <div>Model: <span className="text-slate-200">{ac.model}</span> | Base: <span className="text-slate-200">{ac.home_base_id}</span></div>
                                  <div>Fuel: <span className="text-slate-200">{ac.current_fuel_pct}% ({ac.current_fuel_liters?.toLocaleString() || 0} L)</span> | Status: <span className="text-slate-200">{ac.status}</span></div>
                                </div>
                                {isAffected && (
                                  <div className="mt-1.5 text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    ★ Directly Modified in Current Step
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Airbases Runway Status */}
                      <div>
                        <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          Airbase Runways & Launch Capability
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {currentStep.state_snapshot.airbases.map((base) => {
                            const isAffected = currentStep.affected_entity_ids.includes(base.id);
                            return (
                              <div
                                key={base.id}
                                className={`p-3 rounded-lg border ${
                                  isAffected
                                    ? 'bg-red-950/40 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                                    : 'bg-slate-900/60 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-white">{base.name}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      base.runway_status === 'OPERATIONAL'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    }`}
                                  >
                                    {base.runway_status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">ID: {base.id}</p>
                                <p className="text-[11px] text-slate-400">Avail Fuel: {base.available_fuel_liters?.toLocaleString() || 0} L</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Threat Environment */}
                      <div>
                        <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-400" />
                          Threat Zones Present at T+{formatTime(currentStep.elapsed_seconds)}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {currentStep.state_snapshot.threat_environment.map((th) => (
                            <div key={th.threat_id} className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/40">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-red-200">{th.name || th.type} ({th.threat_id})</span>
                                <span className="text-[10px] text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded">R: {th.effective_radius_km} km</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1">Severity: {th.threat_severity}/5 | CM: {th.countermeasure_required || 'CHAFF/FLARE'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : inspectorView === 'INCIDENTS' ? (
                    <div className="w-full h-full overflow-y-auto p-4 font-mono text-xs space-y-2">
                      <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-2">
                        Cumulative Events Up to Current Step ({currentStepIndex + 1}/{totalSteps})
                      </h3>
                      {currentSession?.steps.slice(0, currentStepIndex + 1).map((s, idx) => (
                        <div
                          key={s.event_id}
                          onClick={() => {
                            setIsPlaying(false);
                            setCurrentStepIndex(idx);
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            idx === currentStepIndex
                              ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                              : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400">#{s.step_index + 1}</span>
                              <span className="font-bold text-white">{s.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">T+{formatTime(s.elapsed_seconds)}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Step Delta View */
                    <div className="w-full h-full overflow-y-auto p-4 font-mono text-xs">
                      <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        Discrete State Delta Generated by Step #{currentStep.step_index + 1}
                      </h3>
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-cyan-200">
                        <pre className="overflow-x-auto text-[11px] leading-relaxed">
                          {JSON.stringify(currentStep.state_delta, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-8 text-center text-slate-500 font-mono text-xs">No active step available.</div>
                )}
              </div>
            </div>

            {/* Right Pane: Active Step Telemetry & Impact Details */}
            <div className="w-[340px] xl:w-[380px] shrink-0 bg-slate-900/70 backdrop-blur-md flex flex-col overflow-y-auto font-mono text-xs">
              <div className="p-4 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    STEP {currentStepIndex + 1} OF {totalSteps}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(currentStep?.severity || 'INFO')}`}>
                    {currentStep?.severity}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white leading-snug">{currentStep?.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(currentStep?.category || '')}`}>
                    {currentStep?.category}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    T + {formatTime(currentStep?.elapsed_seconds || 0)}
                  </span>
                </div>
              </div>

              {/* Event Narrative Description */}
              <div className="p-4 border-b border-slate-800/80 space-y-2">
                <h4 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Operational Description</h4>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">{currentStep?.description}</p>
              </div>

              {/* Affected Entities */}
              <div className="p-4 border-b border-slate-800/80 space-y-2">
                <h4 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Affected System Entities</h4>
                {currentStep?.affected_entity_ids && currentStep.affected_entity_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {currentStep.affected_entity_ids.map((id) => (
                      <span key={id} className="px-2 py-1 bg-slate-950 border border-slate-700 text-cyan-200 rounded text-[11px] font-mono">
                        {id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px] italic">Global system baseline checkpoint</span>
                )}
              </div>

              {/* Step Key State Changes */}
              <div className="p-4 flex-1 space-y-2">
                <h4 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">State Transition Parameters</h4>
                <div className="space-y-1.5">
                  {currentStep && Object.entries(currentStep.state_delta).length > 0 ? (
                    Object.entries(currentStep.state_delta).map(([k, v]) => (
                      <div key={k} className="p-2 rounded bg-slate-950/70 border border-slate-800 text-[11px]">
                        <span className="text-slate-400 block font-bold">{k}:</span>
                        <span className="text-cyan-300 break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-[11px]">Initial unperturbed baseline state.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Lower Section: Playback Transport Ribbon & Scrubber Slider        */}
          {/* ----------------------------------------------------------------- */}
          <div className="h-28 px-4 py-2 border-t border-cyan-500/20 bg-slate-950 flex flex-col justify-between shrink-0 font-mono z-30 select-none">
            {/* Visual Step Ribbon (Nodes on the Timeline) */}
            <div className="relative w-full h-8 flex items-center gap-1 overflow-x-auto px-1 py-0.5">
              {currentSession?.steps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                const sevColor =
                  step.severity === 'CRITICAL'
                    ? 'bg-red-500 text-red-200'
                    : step.severity === 'WARNING'
                    ? 'bg-amber-500 text-amber-200'
                    : 'bg-cyan-500 text-cyan-200';

                return (
                  <button
                    key={step.event_id}
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStepIndex(idx);
                    }}
                    className={`h-7 px-2.5 rounded text-[10px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500/30 text-white border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)] scale-105'
                        : isPassed
                        ? 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500'
                        : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-400'
                    }`}
                    title={`Step ${idx + 1}: ${step.title} (T+${formatTime(step.elapsed_seconds)})`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${sevColor}`} />
                    <span>#{idx + 1}</span>
                    <span className="hidden md:inline max-w-[120px] truncate">{step.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Draggable Scrubber Slider */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                {formatTime(currentStep?.elapsed_seconds || 0)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSteps - 1)}
                value={currentStepIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentStepIndex(Number(e.target.value));
                }}
                className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                {formatTime(currentSession?.duration_seconds || 0)}
              </span>
            </div>

            {/* Controls Bar: Transport Buttons + Speed Selector + Keyboard Tips */}
            <div className="flex items-center justify-between text-xs">
              {/* Transport Buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex(0);
                  }}
                  className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                  title="Jump to Start (Home)"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex((p) => Math.max(0, p - 1));
                  }}
                  disabled={currentStepIndex === 0}
                  className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition-all cursor-pointer"
                  title="Step Backward (Left Arrow)"
                >
                  <span className="font-bold text-xs">◀</span>
                </button>

                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500/25 border border-cyan-400 text-cyan-200 hover:bg-cyan-500/35 transition-all flex items-center gap-1.5 font-bold cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  title="Play / Pause (Spacebar)"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex((p) => Math.min(totalSteps - 1, p + 1));
                  }}
                  disabled={currentStepIndex >= totalSteps - 1}
                  className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition-all cursor-pointer"
                  title="Step Forward (Right Arrow)"
                >
                  <span className="font-bold text-xs">▶</span>
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex(Math.max(0, totalSteps - 1));
                  }}
                  className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                  title="Jump to End (End)"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Speed Controls */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 uppercase hidden sm:inline mr-1">Speed:</span>
                {[0.5, 1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Keyboard helper hint */}
              <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-500">
                <span>[Space] Play/Pause</span>
                <span>[← / →] Step</span>
                <span>[Home / End] Jump</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------------- */
        /* 3. POST-SCENARIO DEBRIEF REPORT VIEW                                */
        /* ------------------------------------------------------------------- */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full font-sans print:p-0 print:max-w-none">
          {debriefReport ? (
            <>
              {/* Report Header & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 print:border-black">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono uppercase font-bold print:border-black print:text-black">
                      AFTER-ACTION REPORT (AAR)
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {debriefReport.session_id}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono print:text-black">
                    {debriefReport.scenario_name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Simulation Range: {debriefReport.start_time} ➔ {debriefReport.end_time} ({formatTime(debriefReport.duration_seconds)})
                  </p>
                </div>

                {/* Print & JSON Export Actions */}
                <div className="flex items-center gap-2 print:hidden font-mono text-xs">
                  <button
                    onClick={handleExportJSON}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT JSON</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-200 flex items-center gap-1.5 transition-all cursor-pointer font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>PRINT / PDF</span>
                  </button>

                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={!selectedSessionId}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer font-bold disabled:opacity-40"
                    title="Delete this replay session permanently from persistent data"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>DELETE SESSION</span>
                  </button>
                </div>
              </div>

              {/* 1. Executive Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 print:border-slate-300">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total Duration</div>
                  <div className="text-xl font-bold text-white mt-1 print:text-black">
                    {formatTime(debriefReport.duration_seconds)}
                  </div>
                  <div className="text-[10px] text-cyan-400 mt-0.5">Recorded timeline</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 print:border-slate-300">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total Simulation Events</div>
                  <div className="text-xl font-bold text-white mt-1 print:text-black">
                    {debriefReport.total_events}
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Discrete steps captured</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 print:border-slate-300">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Warnings Recorded</div>
                  <div className="text-xl font-bold text-amber-300 mt-1 print:text-black">
                    {debriefReport.warnings_count}
                  </div>
                  <div className="text-[10px] text-amber-400 mt-0.5">Contingency flags</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 print:border-slate-300">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Critical Incidents</div>
                  <div className="text-xl font-bold text-red-300 mt-1 print:text-black">
                    {debriefReport.critical_count}
                  </div>
                  <div className="text-[10px] text-red-400 mt-0.5">High-priority disruptions</div>
                </div>
              </div>

              {/* 2. Before and After Comparison Table */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 print:border-slate-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 print:text-black">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Before & After Comparison (Only Changed Entities)
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {debriefReport.before_and_after_comparison.length} modified entities
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase print:border-slate-400">
                        <th className="py-2 px-3">Entity Type</th>
                        <th className="py-2 px-3">Entity ID / Name</th>
                        <th className="py-2 px-3">Property</th>
                        <th className="py-2 px-3">Baseline (T=0)</th>
                        <th className="py-2 px-3">Final State</th>
                        <th className="py-2 px-3">Trigger Event</th>
                        <th className="py-2 px-3">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {debriefReport.before_and_after_comparison.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">{item.entity_type}</td>
                          <td className="py-2.5 px-3 text-white font-medium">{item.name} ({item.entity_id})</td>
                          <td className="py-2.5 px-3 text-slate-400">{item.property_name}</td>
                          <td className="py-2.5 px-3 text-slate-300 bg-slate-950/40">{String(item.baseline_value)}</td>
                          <td className="py-2.5 px-3 text-cyan-200 font-bold bg-slate-950/40">{String(item.final_value)}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.responsible_event || 'Simulation'}</td>
                          <td className="py-2.5 px-3">
                            {item.returned_to_baseline ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                RETURNED TO BASELINE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                STATE MODIFIED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Incident and Recovery Timeline */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 print:border-slate-300">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 print:text-black">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Incident & Recovery Timeline
                </h3>

                <div className="space-y-3">
                  {debriefReport.incident_and_recovery_timeline.map((inc) => (
                    <div
                      key={inc.incident_id}
                      className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getSeverityBadge(inc.severity)}`}>
                            {inc.severity}
                          </span>
                          <span className="font-bold text-white text-sm">{inc.title}</span>
                          <span className="text-[10px] text-slate-400">T+{formatTime(inc.elapsed_seconds)}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Trigger: <span className="text-slate-200">{inc.trigger_event}</span> | Affected: <span className="text-cyan-300">{inc.affected_entities.join(', ')}</span>
                        </p>
                        <p className="text-slate-300 font-sans text-xs">
                          {inc.retasking_summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Status Transition:</div>
                          <div className="text-xs font-bold text-amber-300">{inc.status_transition}</div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-bold ${
                            inc.recovery_status === 'RESOLVED' || inc.recovery_status === 'STABILIZED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {inc.recovery_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Event Breakdown by Category & Severity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {/* Category Breakdown */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Breakdown by Category</h4>
                  <div className="space-y-2">
                    {Object.entries(debriefReport.event_breakdown_by_category).map(([cat, cnt]) => {
                      const pct = Math.round((cnt / debriefReport.total_events) * 100);
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300">{cat}</span>
                            <span className="text-cyan-300 font-bold">{cnt} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Severity Breakdown */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Breakdown by Severity</h4>
                  <div className="space-y-2">
                    {Object.entries(debriefReport.event_breakdown_by_severity).map(([sev, cnt]) => {
                      const pct = Math.round((cnt / debriefReport.total_events) * 100);
                      const barColor = sev === 'CRITICAL' ? 'bg-red-500' : sev === 'WARNING' ? 'bg-amber-500' : 'bg-cyan-500';
                      return (
                        <div key={sev} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300">{sev}</span>
                            <span className="text-white font-bold">{cnt} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 5. Fact-Derived Lessons and Observations */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 print:border-slate-300">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 print:text-black">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Tactical Observations & Simulation Insights
                </h3>
                <div className="space-y-2 font-mono text-xs">
                  {debriefReport.lessons_and_observations.map((obs, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-300 font-sans leading-relaxed">{obs}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synthetic Notice */}
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 text-[11px] font-mono text-slate-500 text-center">
                {debriefReport.synthetic_notice}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">No debrief report loaded.</div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. PERMANENT REPLAY DELETION MODAL (Portaled to document.body)      */}
      {/* ------------------------------------------------------------------- */}
      {showDeleteModal &&
        createPortal(
          <div
            onClick={() => !isDeleting && setShowDeleteModal(false)}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-slate-900 border border-rose-500/50 rounded-2xl shadow-[0_0_60px_rgba(244,63,94,0.35)] overflow-hidden font-mono"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-rose-950/60 border-b border-rose-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-rose-300">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                  <h3 className="font-bold text-sm tracking-wider uppercase text-white">
                    DELETE REPLAY SESSION
                  </h3>
                </div>
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-slate-400 text-[11px] uppercase tracking-wider">
                    Target Session for Deletion:
                  </div>
                  <div className="font-bold text-white text-sm truncate">
                    {currentSession?.scenario_name || selectedSessionId || 'No Session Selected'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                    <div>
                      Session ID: <span className="text-cyan-300">{selectedSessionId || 'N/A'}</span>
                    </div>
                    <div>
                      Events: <span className="text-emerald-300">{currentSession?.steps?.length || currentSession?.event_count || 0}</span>
                    </div>
                    <div>
                      Duration:{' '}
                      <span className="text-amber-300">
                        {formatTime(currentSession?.duration_seconds || 0)}
                      </span>
                    </div>
                    <div>
                      Saved Sessions: <span className="text-slate-200">{sessions.length}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-200/90 text-[11px] space-y-1">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    PERMANENT DATA DISK REMOVAL
                  </div>
                  <p>
                    Deleting a replay permanently purges the recorded simulation frames from the active memory cache and removes them from the persistent storage file (<code className="text-rose-200 font-bold">backend/data/replay_sessions.json</code>).
                  </p>
                </div>

                {/* Action Buttons Stack */}
                <div className="pt-2 space-y-2.5">
                  {/* 1. Delete This Single Session */}
                  <button
                    onClick={handleDeleteCurrentSession}
                    disabled={isDeleting || !selectedSessionId}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_16px_rgba(225,29,72,0.4)] disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {isDeleting ? 'DELETING FROM DISK...' : 'DELETE THIS SESSION ONLY'}
                    </span>
                  </button>

                  {/* 2. Reset Database & Preserve Demo */}
                  <button
                    onClick={() => handleClearAllSessions(true)}
                    disabled={isDeleting}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-200 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>
                      {isDeleting ? 'RESETTING REPLAY DATA...' : 'RESET DATABASE (RESTORE CLEAN DEMO)'}
                    </span>
                  </button>

                  {/* 3. Purge All Sessions */}
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to purge ALL replay sessions from disk?')) {
                        handleClearAllSessions(false);
                      }
                    }}
                    disabled={isDeleting}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>PURGE ALL SESSIONS FROM DISK</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
