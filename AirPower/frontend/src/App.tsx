import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { MissionCommandPanel } from './components/MissionCommandPanel';
import { DemoController } from './components/DemoController';
import { EventAlertOverlay } from './components/EventAlertOverlay';
import { Dashboard } from './components/Dashboard';
import type {
  StateSnapshot,
  MissionPackage,
  PlanMissionResponse,
  EventType,
  Location,
  AirbaseWeatherData,
} from './types';
import {
  fetchState,
  planMission,
  deployPackage,
  triggerEvent,
  closeMission,
  resetScenario,
  fetchTheatreWeather,
} from './services/api';
import { useTacticalWebSocket } from './services/useTacticalWebSocket';
import { LandingPage } from './components/LandingPage';
import { AuditLogPage } from './components/AuditLogPage';
import { ReplayDebriefPanel } from './components/ReplayDebriefPanel';
import { ScenarioComparisonModal } from './components/ScenarioComparisonModal';
import { WeatherDashboard } from './components/WeatherDashboard';
import { AIOperationsAssistant } from './components/AIOperationsAssistant';
import { ChevronLeft, ChevronRight, Play, Crosshair } from 'lucide-react';

export function App() {
  const [state, setState] = useState<StateSnapshot | null>(null);
  const [activeView, setActiveView] = useState<
    'LANDING' | 'MAP' | 'DASHBOARD' | 'WEATHER' | 'DATA_FUSION' | 'MAINTENANCE' | 'REPLAY' | 'AUDIT' | 'ASSISTANT'
  >(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('weather')) return 'WEATHER';
    if (hash.includes('data-fusion') || hash.includes('data_fusion') || hash.includes('trust')) return 'DATA_FUSION';
    if (hash.includes('maintenance') || hash.includes('logistics') || hash.includes('mro')) return 'MAINTENANCE';
    if (hash.includes('replay') || hash.includes('debrief')) return 'REPLAY';
    if (hash.includes('dashboard')) return 'DASHBOARD';
    if (hash.includes('audit')) return 'AUDIT';
    if (hash.includes('assistant') || hash.includes('ai') || hash.includes('chat') || hash.includes('bot')) return 'ASSISTANT';
    if (hash.includes('map')) return 'MAP';
    return 'LANDING';
  });

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [customTargetLocation, setCustomTargetLocation] = useState<Location | null>(null);
  const [planResult, setPlanResult] = useState<PlanMissionResponse | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<MissionPackage | null>(null);
  const [selectedActiveMissionId, setSelectedActiveMissionId] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isClosingMission, setIsClosingMission] = useState(false);
  const [isProcessingEvent, setIsProcessingEvent] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoStepText, setAutoStepText] = useState<string | null>(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);

  // Sync with browser URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('weather')) {
        setActiveView('WEATHER');
      } else if (hash.includes('data-fusion') || hash.includes('data_fusion') || hash.includes('trust')) {
        setActiveView('DATA_FUSION');
      } else if (hash.includes('maintenance') || hash.includes('logistics') || hash.includes('mro')) {
        setActiveView('MAINTENANCE');
      } else if (hash.includes('replay') || hash.includes('debrief')) {
        setActiveView('REPLAY');
      } else if (hash.includes('dashboard')) {
        setActiveView('DASHBOARD');
      } else if (hash.includes('audit')) {
        setActiveView('AUDIT');
      } else if (hash.includes('assistant') || hash.includes('ai') || hash.includes('chat') || hash.includes('bot')) {
        setActiveView('ASSISTANT');
      } else if (hash.includes('map')) {
        setActiveView('MAP');
      } else if (hash.includes('home') || hash.includes('landing') || !hash) {
        setActiveView('LANDING');
      } else {
        setActiveView('MAP');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectView = (
    view: 'LANDING' | 'MAP' | 'DASHBOARD' | 'WEATHER' | 'DATA_FUSION' | 'MAINTENANCE' | 'REPLAY' | 'AUDIT' | 'ASSISTANT'
  ) => {
    setActiveView(view);
    if (view === 'WEATHER') {
      window.location.hash = 'weather';
    } else if (view === 'DATA_FUSION') {
      window.location.hash = 'data-fusion';
    } else if (view === 'MAINTENANCE') {
      window.location.hash = 'maintenance';
    } else if (view === 'REPLAY') {
      window.location.hash = 'replay';
    } else if (view === 'DASHBOARD') {
      window.location.hash = 'dashboard';
    } else if (view === 'AUDIT') {
      window.location.hash = 'audit';
    } else if (view === 'ASSISTANT') {
      window.location.hash = 'assistant';
    } else if (view === 'MAP') {
      window.location.hash = 'map';
    } else {
      window.location.hash = 'home';
    }
  };

  // Panel Collapsing for responsive UX
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Live Toast Alerts
  const [currentAlert, setCurrentAlert] = useState<{
    event_id: string;
    event_type: string;
    message: string;
    retasking_actions: any[];
    timestamp?: string;
  } | null>(null);

  // Load initial state
  const loadState = useCallback(async () => {
    try {
      const data = await fetchState();
      setState(data);
    } catch (err) {
      console.error('Failed to load initial state:', err);
    }
  }, []);

  // Theatre Weather State (Single source of truth shared across map & demo controller)
  const [theatreWeather, setTheatreWeather] = useState<AirbaseWeatherData[]>([]);

  const loadWeather = useCallback(async () => {
    try {
      const res = await fetchTheatreWeather(false);
      setTheatreWeather(res.airbases);
    } catch (err) {
      console.warn('Failed to fetch theatre weather:', err);
    }
  }, []);

  useEffect(() => {
    loadState();
    loadWeather();
    const interval = setInterval(loadWeather, 45000);
    return () => clearInterval(interval);
  }, [loadState, loadWeather]);

  // WebSocket Live Updates
  const handleStateUpdate = useCallback((snapshot: StateSnapshot) => {
    setState(snapshot);
  }, []);

  const handleEventAlert = useCallback(
    (alert: {
      event_id: string;
      event_type: string;
      message: string;
      retasking_actions: any[];
    }) => {
      const alertWithMeta = {
        ...alert,
        timestamp: new Date().toLocaleTimeString(),
      };
      setCurrentAlert(alertWithMeta);

      // Only auto-dismiss non-critical alerts (e.g. generic alerts).
      // Critical alerts (AIRCRAFT_FAILURE, REPLACED, ABORTED) stay until manually dismissed.
      const isCritical =
        alert.event_type === 'AIRCRAFT_FAILURE' ||
        alert.retasking_actions?.some(
          (a) => a.action_type === 'REPLACED' || a.action_type === 'ABORTED'
        );

      if (!isCritical) {
        setTimeout(() => {
          setCurrentAlert((prev) => (prev?.event_id === alert.event_id ? null : prev));
        }, 12000);
      }
    },
    []
  );

  const handleWeatherUpdate = useCallback(() => {
    loadWeather();
    loadState();
  }, [loadWeather, loadState]);

  const { status: wsStatus } = useTacticalWebSocket({
    onStateUpdate: handleStateUpdate,
    onEventAlert: handleEventAlert,
    onWeatherUpdate: handleWeatherUpdate,
  });

  // Action: Generate Plan
  const handleGeneratePlan = async (
    targetId?: string,
    customLoc?: Location,
    priority?: number
  ) => {
    setIsLoadingPlan(true);
    const targetObj = targetId ? state?.mission_targets.find((t) => t.target_id === targetId) : undefined;
    const resolvedPriority = priority ?? (targetObj ? targetObj.priority_level : 4);
    try {
      const res = await planMission({
        target_id: targetId,
        custom_target: customLoc || undefined,
        target_type: customLoc ? 'HARDENED_BUNKER' : undefined,
        priority_level: resolvedPriority,
      });
      setPlanResult(res);
      if (res.packages && res.packages.length > 0) {
        setSelectedPackage(res.packages[0]); // Default to Rank 1 recommended
      } else {
        setSelectedPackage(null);
      }
    } catch (err: any) {
      alert(`Optimization error: ${err.message}`);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // Action: Deploy Package
  const handleDeployPackage = async (packageId: string) => {
    setIsDeploying(true);
    try {
      const deployed = await deployPackage(packageId);
      await loadState();
      setPlanResult(null);
      setSelectedPackage(null);
      if (deployed?.mission_id) {
        setSelectedActiveMissionId(deployed.mission_id);
      }
    } catch (err: any) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  // Action: Close Active Mission
  const handleCloseMission = async (missionId: string) => {
    setIsClosingMission(true);
    try {
      await closeMission(missionId);
      await loadState();
      if (selectedActiveMissionId === missionId) {
        setSelectedActiveMissionId(null);
      }
    } catch (err: any) {
      alert(`Failed to close mission: ${err.message}`);
    } finally {
      setIsClosingMission(false);
    }
  };

  // Action: 1-Click / Voice Scramble Mission
  const handleQuickLaunchMission = async (targetId?: string) => {
    setIsProcessingEvent(true);
    try {
      const tgtId =
        targetId ||
        selectedTargetId ||
        state?.mission_targets[0]?.target_id ||
        'TGT_ALPHA_BUNKER';
      setSelectedTargetId(tgtId);
      const planRes = await planMission({ target_id: tgtId, priority_level: 5 });
      setPlanResult(planRes);
      if (planRes.packages && planRes.packages.length > 0) {
        const pkg = planRes.packages[0];
        setSelectedPackage(pkg);
        const deployed = await deployPackage(pkg.package_id);
        await loadState();
        setPlanResult(null);
        setSelectedPackage(null);
        if (deployed?.mission_id) {
          setSelectedActiveMissionId(deployed.mission_id);
        }
      }
    } catch (err: any) {
      alert(`Mission launch failed: ${err.message}`);
    } finally {
      setIsProcessingEvent(false);
    }
  };

  // Action: Trigger Tactical Event
  const handleTriggerEvent = async (
    eventType: EventType,
    payload: Record<string, any> = {}
  ) => {
    setIsProcessingEvent(true);
    try {
      await triggerEvent(eventType, payload);
      await loadState();
    } catch (err: any) {
      alert(`Event trigger failed: ${err.message}`);
    } finally {
      setIsProcessingEvent(false);
    }
  };

  // Action: Reset Scenario
  const handleResetScenario = async () => {
    setIsProcessingEvent(true);
    try {
      await resetScenario();
      setPlanResult(null);
      setSelectedPackage(null);
      setCurrentAlert(null);
      await loadState();
      await loadWeather();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setIsProcessingEvent(false);
    }
  };

  // 1-Click Complete Autonomous Demo Flow
  const handleAutoDemo = async () => {
    if (isAutoRunning) return;
    setIsAutoRunning(true);
    try {
      // Step 0: Clean Reset
      setAutoStepText('STEP 0/5: Resetting Scenario Baseline...');
      await resetScenario();
      await loadState();
      await new Promise((r) => setTimeout(r, 1200));

      // Step 1: Optimize Mission
      const tgtId = state?.mission_targets[0]?.target_id || 'TGT_ALPHA_BUNKER';
      setSelectedTargetId(tgtId);
      setAutoStepText('STEP 1/5: Requesting CP-SAT Multi-Objective Sortie Plan for Citadel Bunker...');
      const planRes = await planMission({ target_id: tgtId, priority_level: 5 });
      setPlanResult(planRes);
      const topPkg = planRes.packages[0];
      setSelectedPackage(topPkg);
      await new Promise((r) => setTimeout(r, 2200));

      // Step 2: Deploy
      setAutoStepText(`STEP 2/5: Deploying Package #1 (${topPkg.aircraft.callsign} - ${topPkg.pilot.name})...`);
      await deployPackage(topPkg.package_id);
      await loadState();
      setPlanResult(null);
      setSelectedPackage(null);
      await new Promise((r) => setTimeout(r, 2500));

      // Step 3: Trigger Runway Lockout
      setAutoStepText('STEP 3/5: Triggering Emergency 1: Trishul AFS Runway Locked Out...');
      await triggerEvent('RUNWAY_BLOCKED', { airbase_id: topPkg.airbase.id });
      await new Promise((r) => setTimeout(r, 4000));

      // Step 4: Spawn SAM Threat
      setAutoStepText('STEP 4/5: Triggering Emergency 2: High-Altitude S-400 SAM Bubble Spawned...');
      await triggerEvent('NEW_THREAT_ZONE', {
        name: 'Pop-Up S-400 Battery Sector',
        type: 'SAM_RADAR_BATTERY',
        lat: 31.15,
        lng: 75.35,
        radius_km: 65.0,
        severity: 5,
      });
      await new Promise((r) => setTimeout(r, 4000));

      // Step 5: Engine Fault Scramble
      setAutoStepText('STEP 5/5: Triggering Emergency 3: Mid-Flight Engine Fault on Fighter...');
      await triggerEvent('AIRCRAFT_FAILURE', { aircraft_id: topPkg.aircraft.aircraft_id });
      await new Promise((r) => setTimeout(r, 5000));

      setAutoStepText('✓ FULL DEMO COMPLETED! Click Reset to restart.');
      setTimeout(() => setAutoStepText(null), 5000);
    } catch (err: any) {
      alert(`Auto-demo error: ${err.message}`);
    } finally {
      setIsAutoRunning(false);
    }
  };

  const handleMapClickTarget = (loc: Location) => {
    setCustomTargetLocation(loc);
    setSelectedTargetId(null);
  };

  const handleSelectTarget = (targetId: string) => {
    setSelectedTargetId(targetId ? targetId : null);
    setCustomTargetLocation(null);
  };

  if (!state) {
    return (
      <div className="w-screen h-screen bg-[#060D1A] flex flex-col items-center justify-center text-sky-400 font-mono space-y-5">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 border border-slate-700 shadow-[0_0_25px_rgba(255,153,51,0.35)]">
          <svg viewBox="0 0 100 100" className="w-14 h-14 filter drop-shadow">
            <circle cx="50" cy="50" r="48" fill="#FF9933" />
            <circle cx="50" cy="50" r="32" fill="#FFFFFF" />
            <circle cx="50" cy="50" r="16" fill="#138808" />
          </svg>
          <div className="absolute inset-0 rounded-full border-2 border-amber-400/50 pulsing-ring pointer-events-none" />
        </div>
        <div className="text-center">
          <div className="text-base font-bold tracking-widest text-white">BHARATIYA VAYU SENA • INDIAN AIR FORCE</div>
          <div className="text-xs text-sky-300 tracking-wider mt-1">INITIALIZING AIR OPERATIONS C2 SYSTEM...</div>
        </div>
      </div>
    );
  }

  // If in Landing Portal view, display the dedicated defence landing page
  if (activeView === 'LANDING') {
    return (
      <LandingPage
        state={state}
        onLaunchDashboard={(view) => handleSelectView(view || 'MAP')}
      />
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-[#060F1E] text-slate-100 overflow-hidden select-none">
      {/* 1. Header Bar */}
      <Header
        wsStatus={wsStatus}
        activeMissionsCount={state.active_missions.length}
        activeView={activeView}
        onSelectView={handleSelectView}
        eventLogsCount={state.event_log.length}
      />

      {/* Auto-Demo Live Status Banner */}
      {autoStepText && (
        <div className="h-9 px-5 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 border-b border-emerald-500/50 flex items-center justify-between text-xs font-mono text-emerald-300 z-30 shadow-md">
          <div className="flex items-center gap-2">
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-current animate-pulse" />
            <strong className="tracking-wider">AUTONOMOUS DEMO RUNNING:</strong>
            <span className="text-white font-sans">{autoStepText}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 uppercase">Autonomous Tactical Sequencer</span>
        </div>
      )}

      {/* 2. Main Canvas: DASHBOARD VIEW vs DATA FUSION vs MAINTENANCE vs AUDIT LOG vs TACTICAL MAP */}
      {activeView === 'DASHBOARD' || activeView === 'DATA_FUSION' || activeView === 'MAINTENANCE' ? (
        <Dashboard
          state={state}
          initialTab={
            activeView === 'DATA_FUSION'
              ? 'DATA_FUSION'
              : activeView === 'MAINTENANCE'
                ? 'MAINTENANCE'
                : 'AIRCRAFT'
          }
          onNavigateToMap={() => handleSelectView('MAP')}
          onRefreshState={loadState}
        />
      ) : activeView === 'WEATHER' ? (
        <WeatherDashboard onSelectAirbaseOnMap={() => handleSelectView('MAP')} />
      ) : activeView === 'REPLAY' ? (
        <ReplayDebriefPanel
          onNavigateToMap={() => handleSelectView('MAP')}
          onNavigateToDashboard={() => handleSelectView('DASHBOARD')}
        />
      ) : activeView === 'AUDIT' ? (
        <AuditLogPage
          eventLogs={state.event_log}
          onNavigateToMap={() => handleSelectView('MAP')}
          onNavigateToDashboard={() => handleSelectView('DASHBOARD')}
          onResetScenario={handleResetScenario}
        />
      ) : activeView === 'ASSISTANT' ? (
        <AIOperationsAssistant
          onNavigateToView={(view: any) => handleSelectView(view)}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main: Interactive Tactical Map */}
          <div className="flex-1 h-full relative z-0">
            <TacticalMap
              airbases={state.airbases}
              threats={state.threat_environment}
              targets={state.mission_targets}
              activeMissions={state.active_missions}
              selectedPackage={selectedPackage}
              selectedTargetId={selectedTargetId}
              onSelectTarget={handleSelectTarget}
              onMapClickTarget={handleMapClickTarget}
              activeAlertMessage={currentAlert?.message}
              theatreWeather={theatreWeather}
              onRefreshWeather={loadWeather}
            />

            {/* Bottom Floating Demo Controller */}
            <DemoController
              onTriggerEvent={handleTriggerEvent}
              onResetScenario={handleResetScenario}
              onAutoDemo={handleAutoDemo}
              onLaunchMission={handleQuickLaunchMission}
              activeMissionsCount={state.active_missions.length}
              isProcessing={isProcessingEvent}
              isAutoRunning={isAutoRunning}
              airbases={state.airbases}
              onOpenScenarioComparison={() => setShowScenarioModal(true)}
              hasActiveComparison={Boolean(state.active_scenario_comparison)}
              onWeatherUpdated={() => {
                loadState();
                loadWeather();
              }}
            />

            {/* Emergency Alert & Audit Drawer */}
            <EventAlertOverlay
              currentAlert={currentAlert}
              onDismissAlert={() => setCurrentAlert(null)}
              eventLogs={state.event_log}
            />

            {/* Floating Mission Command Panel (Air Force Sky-Blue Floating Glassmorphism) */}
            <div
              className={`absolute top-3 right-3 bottom-3 z-[500] transition-all duration-300 ease-out flex flex-col pointer-events-auto ${
                showRightPanel
                  ? 'w-[380px] xl:w-[415px] opacity-100 translate-x-0'
                  : 'w-0 opacity-0 pointer-events-none translate-x-12 overflow-hidden'
              }`}
            >
              <MissionCommandPanel
                targets={state.mission_targets}
                selectedTargetId={selectedTargetId}
                customTargetLocation={customTargetLocation}
                onSelectTargetId={handleSelectTarget}
                planResult={planResult}
                isLoadingPlan={isLoadingPlan}
                onGeneratePlan={handleGeneratePlan}
                selectedPackage={selectedPackage}
                onSelectPackage={setSelectedPackage}
                onDeployPackage={handleDeployPackage}
                isDeploying={isDeploying}
                activeMissions={state.active_missions}
                selectedActiveMissionId={selectedActiveMissionId}
                onSelectActiveMissionId={setSelectedActiveMissionId}
                onCloseMission={handleCloseMission}
                isClosingMission={isClosingMission}
                eventLog={state.event_log}
                onClose={() => setShowRightPanel(false)}
              />
            </div>

            {/* Floating Expand Tab when Panel is Collapsed */}
            {!showRightPanel && (
              <button
                onClick={() => setShowRightPanel(true)}
                className="absolute top-3 right-3 z-[500] glass-panel-floating px-3.5 py-2.5 rounded-xl border border-sky-400/40 text-sky-200 hover:text-white hover:border-sky-300 flex items-center gap-2 shadow-[0_8px_32px_rgba(2,132,199,0.35)] cursor-pointer transition-all hover:scale-105 font-mono text-xs"
                title="Open Mission Command Panel"
              >
                <Crosshair className="w-4 h-4 text-sky-400 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="font-bold tracking-wider">MISSION COMMAND</span>
                <ChevronLeft className="w-4 h-4 text-sky-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scenario Comparison Modal */}
      {showScenarioModal && (
        <ScenarioComparisonModal
          comparison={state.active_scenario_comparison || null}
          onClose={() => setShowScenarioModal(false)}
          onResetScenario={async () => {
            await handleResetScenario();
            setShowScenarioModal(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
