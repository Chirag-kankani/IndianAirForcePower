import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Radio,
  Wrench,
  RotateCcw,
  Play,
  ChevronUp,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle2,
  X,
  Flame,
  Lock,
  ChevronRight,
  GitCompare,
  CloudLightning,
  CloudRain,
  Wind,
  EyeOff,
  CloudSun,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Terminal,
  Plane,
} from 'lucide-react';
import type { Airbase, EventType, WeatherScenarioType } from '../types';
import { injectWeatherScenario, resetWeatherScenario } from '../services/api';

interface DemoControllerProps {
  onTriggerEvent: (eventType: EventType, payload?: Record<string, any>) => void;
  onResetScenario: () => void;
  onAutoDemo?: () => void;
  onLaunchMission?: () => Promise<void>;
  activeMissionsCount?: number;
  isProcessing: boolean;
  isAutoRunning?: boolean;
  airbases?: Airbase[];
  onOpenScenarioComparison?: () => void;
  hasActiveComparison?: boolean;
  onWeatherUpdated?: () => void;
}

export const DemoController: React.FC<DemoControllerProps> = ({
  onTriggerEvent,
  onResetScenario,
  onAutoDemo,
  onLaunchMission,
  activeMissionsCount = 0,
  isProcessing,
  isAutoRunning,
  airbases = [],
  onOpenScenarioComparison,
  hasActiveComparison = false,
  onWeatherUpdated,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Mod 12: runway picker popover state
  const [showRunwayPicker, setShowRunwayPicker] = useState(false);
  const runwayPickerRef = useRef<HTMLDivElement>(null);

  // Weather Hazard Injector state
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);
  const [selectedWeatherScenario, setSelectedWeatherScenario] =
    useState<WeatherScenarioType>('THUNDERSTORM_SQUALL');
  const [selectedWeatherAirbase, setSelectedWeatherAirbase] = useState<string>(
    airbases[0]?.id || 'BASE_TRISHUL'
  );
  const [isWeatherInjecting, setIsWeatherInjecting] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const weatherPickerRef = useRef<HTMLDivElement>(null);

  // Close runway picker on outside click
  useEffect(() => {
    if (!showRunwayPicker) return;
    const handler = (e: MouseEvent) => {
      if (runwayPickerRef.current && !runwayPickerRef.current.contains(e.target as Node)) {
        setShowRunwayPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRunwayPicker]);

  // Close weather picker on outside click
  useEffect(() => {
    if (!showWeatherPicker) return;
    const handler = (e: MouseEvent) => {
      if (weatherPickerRef.current && !weatherPickerRef.current.contains(e.target as Node)) {
        setShowWeatherPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWeatherPicker]);

  const injectSpecificWeather = async (scenario: WeatherScenarioType, baseId?: string) => {
    const targetBase = baseId || selectedWeatherAirbase || airbases[0]?.id || 'BASE_TRISHUL';
    setIsWeatherInjecting(true);
    setWeatherNotice(null);
    try {
      await injectWeatherScenario(targetBase, scenario);
      setWeatherNotice(`Injected ${scenario} at ${targetBase}`);
      if (onWeatherUpdated) onWeatherUpdated();
      onTriggerEvent('WEATHER_SCENARIO_INJECTED' as any, {
        airbase_id: targetBase,
        scenario_type: scenario,
      });
    } catch (err: any) {
      setWeatherNotice(err.message || 'Failed to inject weather hazard');
    } finally {
      setIsWeatherInjecting(false);
    }
  };

  const handleInjectWeather = async () => {
    if (!selectedWeatherAirbase) return;
    await injectSpecificWeather(selectedWeatherScenario, selectedWeatherAirbase);
    setTimeout(() => setShowWeatherPicker(false), 900);
  };

  const handleResetWeather = async () => {
    setIsWeatherInjecting(true);
    setWeatherNotice(null);
    try {
      await resetWeatherScenario(selectedWeatherAirbase);
      setWeatherNotice('Restored live Open-Meteo observations');
      if (onWeatherUpdated) onWeatherUpdated();
      onTriggerEvent('WEATHER_SCENARIO_RESET' as any, {
        airbase_id: selectedWeatherAirbase,
      });
      setTimeout(() => setShowWeatherPicker(false), 900);
    } catch (err: any) {
      setWeatherNotice(err.message || 'Failed to reset weather');
    } finally {
      setIsWeatherInjecting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Voice Control System (Web Speech API Recognition + Speech Synthesis)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Voice Control System (Web Speech API + Synthesizer Voice Note Responses)
  // ---------------------------------------------------------------------------
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<{
    transcript: string;
    matchedCommand?: string;
    isError?: boolean;
    isInterim?: boolean;
    isSpeaking?: boolean;
    spokenText?: string;
    timestamp: number;
  } | null>(null);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const voiceTimeoutRef = useRef<any>(null);

  // Web Audio Tactical Beep / Chime Generator (No external files needed)
  const playChime = (type: 'listen' | 'ack' | 'warn') => {
    if (voiceMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'listen') {
        // High-tech radio frequency open beep
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'ack') {
        // Positive tactical acknowledgment chirp (C5 -> G5)
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'warn') {
        // Warning radio pulse
        osc.frequency.setValueAtTime(340, now);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch (e) {
      // Audio fallback
    }
  };

  const triggerVoiceFeedback = (data: {
    transcript: string;
    matchedCommand?: string;
    isError?: boolean;
    isInterim?: boolean;
    spokenText?: string;
  }) => {
    if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    setVoiceFeedback((prev) => ({
      ...prev,
      ...data,
      timestamp: Date.now(),
    }));

    if (!data.isInterim) {
      voiceTimeoutRef.current = setTimeout(() => {
        setVoiceFeedback(null);
      }, 5500);
    }
  };

  const speakFeedback = (text: string) => {
    if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      isSpeakingRef.current = true;
      setVoiceFeedback((prev) =>
        prev
          ? { ...prev, isSpeaking: true, spokenText: text }
          : { transcript: '', isSpeaking: true, spokenText: text, timestamp: Date.now() }
      );

      // Brief delay to allow browser speech engine queue reset
      setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          utterance.lang = 'en-US';

          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            const preferred =
              voices.find(
                (v) =>
                  v.lang.startsWith('en') &&
                  (v.name.includes('Natural') ||
                    v.name.includes('Google') ||
                    v.name.includes('Samantha') ||
                    v.name.includes('David') ||
                    v.name.includes('Zira'))
              ) || voices.find((v) => v.lang.startsWith('en'));
            if (preferred) utterance.voice = preferred;
          }

          utterance.onend = () => {
            // Buffer delay after speech finishes to prevent microphone picking up acoustic room echo
            setTimeout(() => {
              isSpeakingRef.current = false;
            }, 600);
            setVoiceFeedback((prev) => (prev ? { ...prev, isSpeaking: false } : null));
          };
          utterance.onerror = () => {
            isSpeakingRef.current = false;
            setVoiceFeedback((prev) => (prev ? { ...prev, isSpeaking: false } : null));
          };

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          isSpeakingRef.current = false;
          console.warn('SpeechSynthesis speak failed:', e);
        }
      }, 50);
    } catch (e) {
      isSpeakingRef.current = false;
      console.warn('SpeechSynthesis error:', e);
    }
  };

  const parseVoiceCommand = (rawTranscript: string) => {
    const text = rawTranscript.toLowerCase().trim();
    if (!text) return;

    // 0. Mission Launch, Planning & Scramble Sorties
    if (
      text.includes('launch mission') ||
      text.includes('start mission') ||
      text.includes('deploy mission') ||
      text.includes('deploy sortie') ||
      text.includes('scramble') ||
      text.includes('strike target') ||
      text.includes('attack target') ||
      text.includes('plan mission') ||
      text.includes('optimize mission') ||
      text.includes('fly mission') ||
      text.includes('launch sortie') ||
      text.includes('scramble fighter')
    ) {
      playChime('ack');
      const voiceNote = 'Acknowledged: Planning optimal sortie package and scrambling fighter. Mission is now airborne on the map.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'SCRAMBLE FIGHTER SORTIE',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      if (onLaunchMission) {
        onLaunchMission();
      }
      return;
    }

    // 1. SAM Threat Injections
    if (
      text.includes('sam') ||
      text.includes('missile') ||
      text.includes('battery') ||
      text.includes('radar threat') ||
      text.includes('s400') ||
      text.includes('s-400')
    ) {
      playChime('ack');
      const voiceNote = 'Threat alert acknowledged: Pop-up S-400 radar threat zone injected into theatre. Sorties are actively rerouting.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'SPAWN SAM RADAR BATTERY',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);

      const injectSam = () => {
        handleAction('SAM', 'NEW_THREAT_ZONE', {
          name: 'Pop-Up S-400 Battery Sector',
          type: 'SAM_RADAR_BATTERY',
          lat: 31.15,
          lng: 75.35,
          radius_km: 65.0,
          severity: 5,
        });
      };

      // If no missions are currently airborne, launch a fighter first so the evasive detour is immediately visible!
      if (activeMissionsCount === 0 && onLaunchMission) {
        onLaunchMission().then(() => {
          setTimeout(injectSam, 1200);
        });
      } else {
        injectSam();
      }
      return;
    }

    // 2. Weather Hazards
    if (text.includes('thunderstorm') || text.includes('squall') || text.includes('microburst')) {
      playChime('ack');
      const voiceNote = 'Weather alert acknowledged: Severe convective squall line and microburst active across airbases.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'INJECT THUNDERSTORM SQUALL',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      setSelectedWeatherScenario('THUNDERSTORM_SQUALL');
      injectSpecificWeather('THUNDERSTORM_SQUALL');
      return;
    }

    if (text.includes('gale') || text.includes('wind') || text.includes('crosswind')) {
      playChime('ack');
      const voiceNote = 'Weather alert acknowledged: High-velocity gale crosswinds active across airfield.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'INJECT GALE CROSSWINDS',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      setSelectedWeatherScenario('GALE_WINDS');
      injectSpecificWeather('GALE_WINDS');
      return;
    }

    if (text.includes('monsoon') || text.includes('rain') || text.includes('downpour')) {
      playChime('ack');
      const voiceNote = 'Weather alert acknowledged: Monsoon downpour and heavy precipitation active.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'INJECT MONSOON DOWNPOUR',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      setSelectedWeatherScenario('MONSOON_DOWNPOUR');
      injectSpecificWeather('MONSOON_DOWNPOUR');
      return;
    }

    if (text.includes('fog') || text.includes('visibility') || text.includes('mist')) {
      playChime('ack');
      const voiceNote = 'Weather alert acknowledged: Dense radiation fog with Category 3 visibility active.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'INJECT DENSE RADIATION FOG',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      setSelectedWeatherScenario('DENSE_FOG');
      injectSpecificWeather('DENSE_FOG');
      return;
    }

    if (text.includes('clear weather') || text.includes('reset weather') || text.includes('normal weather') || text.includes('restore weather')) {
      playChime('ack');
      const voiceNote = 'Acknowledged: Restoring live real-time Open-Meteo observations.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'RESTORE METEO OBSERVATIONS',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      handleResetWeather();
      return;
    }

    if (text.includes('weather') || text.includes('hazard')) {
      playChime('ack');
      const voiceNote = `Weather hazard injected: Scenario ${selectedWeatherScenario.toLowerCase().replace('_', ' ')} active.`;
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: `INJECT WEATHER (${selectedWeatherScenario})`,
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      injectSpecificWeather(selectedWeatherScenario);
      return;
    }

    // 3. Runway Lockout
    if (text.includes('lock runway') || text.includes('block runway') || text.includes('close runway') || text.includes('runway lockout')) {
      let targetBase = airbases[0]?.id || 'BASE_TRISHUL';
      if (text.includes('shakti')) {
        const b = airbases.find((ab) => ab.name.toLowerCase().includes('shakti') || ab.id.includes('SHAKTI'));
        if (b) targetBase = b.id;
      } else if (text.includes('trishul')) {
        const b = airbases.find((ab) => ab.name.toLowerCase().includes('trishul') || ab.id.includes('TRISHUL'));
        if (b) targetBase = b.id;
      } else if (text.includes('garuda')) {
        const b = airbases.find((ab) => ab.name.toLowerCase().includes('garuda') || ab.id.includes('GARUDA'));
        if (b) targetBase = b.id;
      } else if (text.includes('vayu')) {
        const b = airbases.find((ab) => ab.name.toLowerCase().includes('vayu') || ab.id.includes('VAYU'));
        if (b) targetBase = b.id;
      }
      playChime('ack');
      const voiceNote = `Runway lockout acknowledged: ${targetBase.replace('BASE_', '')} runway is closed. Diverting airborne sorties.`;
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: `LOCK RUNWAY [${targetBase.replace('BASE_', '')}]`,
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);

      const doLock = () => handleLockRunway(targetBase);
      if (activeMissionsCount === 0 && onLaunchMission) {
        onLaunchMission().then(() => {
          setTimeout(doLock, 1200);
        });
      } else {
        doLock();
      }
      return;
    }

    // 4. Aircraft Engine Fault
    if (text.includes('engine') || text.includes('flameout') || text.includes('turbine') || text.includes('failure') || text.includes('fault')) {
      playChime('warn');
      const voiceNote = 'In-flight emergency acknowledged: Turbine failure injected. Emergency recovery initiated.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'INJECT ENGINE FAULT EMERGENCY',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);

      const doFault = () => handleAction('FAULT', 'AIRCRAFT_FAILURE', {});
      if (activeMissionsCount === 0 && onLaunchMission) {
        onLaunchMission().then(() => {
          setTimeout(doFault, 1200);
        });
      } else {
        doFault();
      }
      return;
    }

    // 5. 1-Click Autonomous Demo
    if (text.includes('demo') || text.includes('simulation') || text.includes('start demo') || text.includes('run demo') || text.includes('launch demo')) {
      playChime('ack');
      const voiceNote = 'Autonomous presentation sequence initiated. Executing end-to-end tactical simulation.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'EXECUTING 1-CLICK DEMO',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      if (onAutoDemo) onAutoDemo();
      return;
    }

    // 6. Reset
    if (text.includes('reset') || text.includes('restart') || text.includes('clear all') || text.includes('abort')) {
      playChime('ack');
      const voiceNote = 'Reset command acknowledged. Restoring all assets, runways, and airbases to baseline readiness.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'TACTICAL SCENARIO RESET',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      onResetScenario();
      return;
    }

    // 7. Delta / Comparison
    if (text.includes('compare') || text.includes('delta') || text.includes('results')) {
      playChime('ack');
      const voiceNote = 'Acknowledged: Opening before and after delta comparison report.';
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'OPEN DELTA COMPARISON',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      if (onOpenScenarioComparison) onOpenScenarioComparison();
      return;
    }

    // 8. Help Cheatsheet
    if (text.includes('help') || text.includes('commands') || text.includes('options')) {
      playChime('ack');
      const voiceNote = 'Opening tactical voice commands directory.';
      setShowVoiceHelp(true);
      triggerVoiceFeedback({
        transcript: rawTranscript,
        matchedCommand: 'OPENING VOICE COMMANDS CHEATSHEET',
        spokenText: voiceNote,
      });
      speakFeedback(voiceNote);
      return;
    }

    // Unrecognized phrase — speak audible acknowledgment of what was heard and suggest commands!
    playChime('warn');
    const fallbackNote = `Voice heard: "${rawTranscript}". Command not recognized. Say launch mission, spawn SAM, or help.`;
    triggerVoiceFeedback({
      transcript: rawTranscript,
      matchedCommand: 'UNRECOGNIZED (Say "Launch mission" or "Spawn SAM")',
      isError: true,
      spokenText: fallbackNote,
    });
    speakFeedback(fallbackNote);
  };

  const toggleVoiceControl = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Voice Control requires a browser that supports the Web Speech API (such as Google Chrome or Microsoft Edge).');
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      triggerVoiceFeedback({
        transcript: 'Voice control paused',
      });
      return;
    }

    // Play tactile activation tone ONCE when the user clicks the button
    playChime('listen');
    triggerVoiceFeedback({
      transcript: 'Listening... (Speak "Launch mission", "Spawn SAM", "Thunderstorm")',
    });

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // onstart only updates state — NEVER speaks out loud so it cannot trigger an infinite audio loop!
      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        // If the system is currently speaking out of the speakers, ignore to prevent acoustic feedback loop!
        if (isSpeakingRef.current) return;

        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (interimText && !finalText) {
          triggerVoiceFeedback({
            transcript: interimText,
            isInterim: true,
          });
        }

        if (finalText.trim()) {
          parseVoiceCommand(finalText.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access was denied. Please allow microphone permissions in your browser to use Voice Control.');
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Debounce before restarting recognition to keep Chrome audio subsystem stable
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Ignore if already active
              }
            }
          }, 300);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      alert('Failed to start voice control: ' + err.message);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    };
  }, []);

  const handleAction = async (actionKey: string, eventType: EventType, payload: Record<string, any> = {}) => {
    if (isProcessing || isAutoRunning) return;
    setActiveAction(actionKey);
    try {
      await onTriggerEvent(eventType, payload);
    } finally {
      setTimeout(() => setActiveAction(null), 800);
    }
  };

  const handleLockRunway = async (baseId: string) => {
    setShowRunwayPicker(false);
    await handleAction('RUNWAY', 'RUNWAY_BLOCKED', { airbase_id: baseId });
  };

  const handleConfirmReset = () => {
    setShowResetConfirm(false);
    onResetScenario();
  };

  if (isCollapsed) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="glass-panel-floating px-4 py-2 rounded-full border border-sky-400/40 text-sky-300 hover:text-white text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-[0_8px_30px_rgba(2,132,199,0.35)] cursor-pointer hover:border-sky-300 group"
          title="Expand Tactical Demo Controls"
        >
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <span>TACTICAL DEMO CONTROLS</span>
          <ChevronUp className="w-4 h-4 text-sky-400 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] select-none font-mono text-xs max-w-fit w-auto pointer-events-auto">
      {/* Voice Recognition Floating HUD Feedback */}
      {voiceFeedback && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 pointer-events-none select-none z-[500] whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-md ${
              voiceFeedback.isError
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-200 shadow-rose-900/30'
                : voiceFeedback.matchedCommand
                ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200 shadow-emerald-900/30 ring-1 ring-emerald-400/30'
                : voiceFeedback.isInterim
                ? 'bg-amber-950/90 border-amber-400/60 text-amber-200 shadow-amber-900/30'
                : 'bg-sky-950/90 border-sky-400/60 text-sky-200 shadow-sky-900/30'
            }`}
          >
            {voiceFeedback.isError ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : voiceFeedback.matchedCommand ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" />
            ) : voiceFeedback.isInterim ? (
              <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            ) : (
              <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0 animate-pulse" />
            )}

            <div className="flex items-center gap-2 text-[11px] font-mono">
              {voiceFeedback.isInterim ? (
                <span>
                  <span className="opacity-70 text-amber-300">Hearing: </span>
                  <span className="font-semibold text-white italic">"{voiceFeedback.transcript}..."</span>
                </span>
              ) : (
                <span>
                  <span className="opacity-70">Heard: </span>
                  <span className="font-semibold text-white">"{voiceFeedback.transcript}"</span>
                  {voiceFeedback.matchedCommand && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[10px]">
                      ➔ {voiceFeedback.matchedCommand}
                    </span>
                  )}
                </span>
              )}

              {/* Spoken Voice Note confirmation badge */}
              {voiceFeedback.spokenText && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-sky-400/30 text-[10.5px]">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-pulse shrink-0" />
                  <span className="text-cyan-200 font-sans font-semibold">
                    Voice Note: <span className="text-white font-normal italic">"{voiceFeedback.spokenText}"</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel-floating px-3.5 py-1.5 rounded-2xl border border-sky-400/40 shadow-[0_12px_40px_rgba(2,132,199,0.3)] flex items-center gap-2 backdrop-blur-xl">
        {/* Badge & Operational Indicator */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-sky-500/25 shrink-0">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isAutoRunning ? 'bg-emerald-400' : isProcessing ? 'bg-amber-400' : 'bg-sky-400'
              } opacity-75`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isAutoRunning ? 'bg-emerald-400' : isProcessing ? 'bg-amber-400' : 'bg-sky-400'
              }`}
            ></span>
          </span>
          <span className="font-extrabold text-[11px] font-sans tracking-wide text-white flex items-center gap-1.5">
            INJECTOR
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30">
              {isAutoRunning ? 'RUNNING' : isProcessing ? 'ACTIVE' : 'READY'}
            </span>
          </span>
        </div>

        {/* Tactical Voice Control Toggle */}
        <div className="flex items-center gap-1 pr-2 border-r border-sky-500/25 shrink-0">
          <button
            onClick={toggleVoiceControl}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 active:scale-95 ${
              isListening
                ? 'bg-rose-500/25 border-rose-400 text-rose-200 ring-2 ring-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-200 hover:border-sky-400 shadow-[0_0_10px_rgba(2,132,199,0.2)]'
            }`}
            title={
              isListening
                ? 'Voice Recognition Active - Click to Stop'
                : 'Activate Tactical Voice Control (Control SAMs, Weather, Runways, Engines)'
            }
          >
            {isListening ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <Mic className="w-3.5 h-3.5 text-rose-300 animate-bounce" />
                <span className="text-[11px] font-sans font-bold tracking-tight">LISTENING</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-sky-300" />
                <span className="text-[11px] font-sans font-bold tracking-tight">VOICE</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowVoiceHelp(true)}
            className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-sky-500/30 hover:border-sky-400 text-sky-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="View Tactical Voice Commands Guide & Test Phrases"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. Runway Lockout Popover */}
        <div className="relative" ref={runwayPickerRef}>
          <button
            onClick={() => {
              if (!isProcessing && !isAutoRunning) setShowRunwayPicker((v) => !v);
            }}
            disabled={isProcessing || isAutoRunning}
            title="Lock out an airbase runway; triggers autonomous mid-flight divert"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              showRunwayPicker || activeAction === 'RUNWAY'
                ? 'bg-amber-500/35 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200 hover:border-amber-400'
            } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.15)]`}
          >
            {activeAction === 'RUNWAY' ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span>Lock Runway ▾</span>
          </button>

          {/* Upward popover */}
          {showRunwayPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-[500] w-64 glass-panel rounded-xl border border-amber-500/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Select Runway to Lock
                </span>
                <button
                  onClick={() => setShowRunwayPicker(false)}
                  className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-1.5 space-y-1 max-h-56 overflow-y-auto">
                {airbases.length === 0 && (
                  <div className="text-[10px] text-slate-500 italic text-center py-3">
                    No airbase data available.
                  </div>
                )}
                {airbases.map((base) => {
                  const isBlocked = base.runway_status === 'BLOCKED';
                  return (
                    <button
                      key={base.id}
                      onClick={() => !isBlocked && handleLockRunway(base.id)}
                      disabled={isBlocked}
                      title={isBlocked ? 'Runway already locked' : `Lock ${base.name}`}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono transition-all ${
                        isBlocked
                          ? 'opacity-45 cursor-not-allowed bg-slate-900/40'
                          : 'cursor-pointer hover:bg-amber-500/15 hover:border-amber-500/40 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isBlocked ? 'bg-rose-500' : 'bg-emerald-400'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-slate-100 leading-tight">{base.name}</div>
                          <div className="text-[9px] text-slate-500">
                            {base.lat.toFixed(2)}°N · {base.lng.toFixed(2)}°E
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            isBlocked
                              ? 'text-rose-400 border-rose-500/50 bg-rose-500/10'
                              : 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
                          }`}
                        >
                          {isBlocked ? 'LOCKED' : 'READY'}
                        </span>
                        {!isBlocked && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-3 py-1 border-t border-slate-800/80 text-[9px] text-slate-500 italic">
                Select base to trigger diversion.
              </div>
            </div>
          )}
        </div>

        {/* 2. Spawn SAM */}
        <button
          onClick={() =>
            handleAction('SAM', 'NEW_THREAT_ZONE', {
              name: 'Pop-Up S-400 Battery Sector',
              type: 'SAM_RADAR_BATTERY',
              lat: 31.15,
              lng: 75.35,
              radius_km: 65.0,
              severity: 5,
            })
          }
          disabled={isProcessing || isAutoRunning}
          title="Inject pop-up S-400 SAM missile radar corridor; calculates dynamic zero-threat detour"
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeAction === 'SAM'
              ? 'bg-red-500/35 border-red-400 text-red-200 ring-1 ring-red-400/50'
              : 'bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-red-200 hover:border-red-400'
          } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.15)]`}
        >
          {activeAction === 'SAM' ? (
            <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
          ) : (
            <Radio className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
          )}
          <span>Spawn SAM</span>
        </button>

        {/* 3. Jet Engine Fault */}
        <button
          onClick={() => handleAction('FAULT', 'AIRCRAFT_FAILURE', {})}
          disabled={isProcessing || isAutoRunning}
          title="Simulate turbine flameout on primary jet; triggers mission abort & autonomous standby scramble"
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            activeAction === 'FAULT'
              ? 'bg-rose-500/35 border-rose-400 text-rose-200 ring-1 ring-rose-400/50'
              : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-200 hover:border-rose-400'
          } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(244,63,94,0.15)]`}
        >
          {activeAction === 'FAULT' ? (
            <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
          ) : (
            <Wrench className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>Engine Fault</span>
        </button>

        {/* 3b. Weather Hazard Scenario Injector */}
        <div className="relative" ref={weatherPickerRef}>
          <button
            onClick={() => {
              if (!isProcessing && !isAutoRunning) setShowWeatherPicker((v) => !v);
            }}
            disabled={isProcessing || isAutoRunning}
            title="Inject synthetic meteorological hazard (Gale Winds, Downpour, Dense Fog, Thunderstorm Squall)"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              showWeatherPicker
                ? 'bg-sky-500/35 border-sky-400 text-sky-200 ring-1 ring-sky-400/50'
                : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-200 hover:border-sky-400'
            } disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_10px_rgba(14,165,233,0.15)]`}
          >
            {isWeatherInjecting ? (
              <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
            ) : (
              <CloudLightning className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span>Weather Hazard ▾</span>
          </button>

          {/* Upward popover */}
          {showWeatherPicker && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[500] w-80 glass-panel rounded-xl border border-sky-500/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between bg-sky-950/40">
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CloudLightning className="w-3.5 h-3.5 text-sky-400" />
                  Weather Hazard Injector
                </span>
                <button
                  onClick={() => setShowWeatherPicker(false)}
                  className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 space-y-2.5">
                {/* Target Airbase Selector */}
                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">
                    Target Airbase
                  </label>
                  <select
                    value={selectedWeatherAirbase}
                    onChange={(e) => setSelectedWeatherAirbase(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    {airbases.map((ab) => (
                      <option key={ab.id} value={ab.id}>
                        {ab.name} ({ab.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scenario Presets */}
                <div>
                  <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">
                    Synthetic Hazard Scenario
                  </label>
                  <div className="space-y-1.5">
                    {[
                      {
                        type: 'THUNDERSTORM_SQUALL' as WeatherScenarioType,
                        label: 'Thunderstorm Squall',
                        desc: 'Convective microburst, severe turbulence, code 99',
                        icon: CloudLightning,
                      },
                      {
                        type: 'GALE_WINDS' as WeatherScenarioType,
                        label: 'Gale Crosswinds',
                        desc: '68 km/h sustained, 88 km/h gusts (takeoff limit)',
                        icon: Wind,
                      },
                      {
                        type: 'MONSOON_DOWNPOUR' as WeatherScenarioType,
                        label: 'Monsoon Downpour',
                        desc: '14.5 mm/h rain, standing water, hydroplaning',
                        icon: CloudRain,
                      },
                      {
                        type: 'DENSE_FOG' as WeatherScenarioType,
                        label: 'Dense Radiation Fog',
                        desc: '350m visibility, below CAT-I minimums',
                        icon: EyeOff,
                      },
                    ].map((s) => {
                      const Icon = s.icon;
                      const isSelected = selectedWeatherScenario === s.type;
                      return (
                        <div
                          key={s.type}
                          onClick={() => setSelectedWeatherScenario(s.type)}
                          className={`p-2 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/40 text-white'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                              <Icon className="w-3.5 h-3.5 text-sky-400" />
                              {s.label}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/30 text-sky-200 font-bold">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">{s.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {weatherNotice && (
                  <div className="p-1.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-200 text-[10px] text-center">
                    {weatherNotice}
                  </div>
                )}

                {/* Synthetic Notice */}
                <div className="text-[9px] text-slate-500 bg-slate-950/60 p-1.5 rounded border border-slate-800 text-center font-mono">
                  SYNTHETIC SIMULATION • REAL OPEN-METEO DATA PRESERVED
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleInjectWeather}
                    disabled={isWeatherInjecting}
                    className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-900/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isWeatherInjecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudLightning className="w-3.5 h-3.5" />
                    )}
                    Inject Hazard
                  </button>
                  <button
                    onClick={handleResetWeather}
                    disabled={isWeatherInjecting}
                    title="Clear synthetic overrides and restore actual Open-Meteo observations"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-slate-800 shrink-0 mx-0.5" />

        {/* 4. Autonomous 1-Click Demo */}
        {onAutoDemo && (
          <button
            onClick={onAutoDemo}
            disabled={isProcessing || isAutoRunning}
            title="Execute fully autonomous multi-stage operational scenario demonstration"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isAutoRunning
                ? 'bg-emerald-500 text-black animate-pulse'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] active:scale-95'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isAutoRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isAutoRunning ? 'DEMO RUNNING' : '1-CLICK DEMO'}</span>
          </button>
        )}

        {/* 5. Simulation Delta Results */}
        {onOpenScenarioComparison && (
          <button
            onClick={onOpenScenarioComparison}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
              hasActiveComparison
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Inspect side-by-side Before/After simulation comparison"
          >
            <GitCompare className="w-3.5 h-3.5 text-amber-400" />
            <span>DELTA</span>
          </button>
        )}

        {/* 6. Reset */}
        <button
          onClick={() => setShowResetConfirm(true)}
          disabled={isProcessing || isAutoRunning}
          title="Reset all aircraft, missions, airbases, and threat environment to default state"
          className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Reset</span>
        </button>

        {/* 7. Minimize */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0 ml-0.5"
          title="Minimize Scenario Injector"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Reset Confirmation Dialog Modal (Portaled to document.body to prevent transform clipping) */}
      {showResetConfirm &&
        createPortal(
          <div
            onClick={() => setShowResetConfirm(false)}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass-panel p-5 rounded-2xl border border-amber-500/50 shadow-2xl space-y-3 font-mono text-xs animate-in zoom-in-95 duration-150 bg-slate-950/95"
            >
              <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" />
                  Confirm Tactical Reset
                </span>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="text-slate-400 hover:text-white p-1 rounded cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-slate-200 text-xs font-sans leading-relaxed">
                Are you sure you want to restore all aircraft readiness, pilot duty logs, runways, and threat environments to default seeded baseline?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-md transition-colors"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Tactical Voice Commands Directory Modal (Portaled to document.body) */}
      {showVoiceHelp &&
        createPortal(
          <div
            onClick={() => setShowVoiceHelp(false)}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl glass-panel p-6 rounded-2xl border border-sky-400/50 shadow-[0_20px_60px_rgba(2,132,199,0.35)] space-y-4 font-mono text-xs animate-in zoom-in-95 duration-150 bg-slate-950/95 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between text-sky-400 font-bold border-b border-sky-500/25 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-extrabold text-white tracking-wide">
                      TACTICAL VOICE COMMAND DIRECTORY
                    </h3>
                    <p className="text-[11px] font-mono text-sky-300/80 font-normal">
                      Hands-free simulation injection via browser speech recognition
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVoiceMuted((v) => !v)}
                    className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      voiceMuted
                        ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                        : 'bg-sky-950/80 border-sky-500/40 text-sky-300'
                    }`}
                    title={voiceMuted ? 'Voice audio synthesis muted' : 'Voice audio synthesis enabled'}
                  >
                    {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span className="text-[10px]">{voiceMuted ? 'Muted' : 'Audio On'}</span>
                  </button>

                  <button
                    onClick={() => setShowVoiceHelp(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status and Instructions Banner */}
              <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-200 text-[11px] font-sans flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                        isListening ? 'bg-rose-400' : 'bg-sky-400'
                      } opacity-75`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isListening ? 'bg-rose-500' : 'bg-sky-400'
                      }`}
                    ></span>
                  </span>
                  <span>
                    Status:{' '}
                    <strong className="text-white">
                      {isListening ? 'LISTENING TO MICROPHONE' : 'STANDBY (Click VOICE in Injector to activate)'}
                    </strong>
                  </span>
                </div>
                <span className="text-[10px] text-sky-300/70 font-mono">Tip: Click any phrase below to test</span>
              </div>

              {/* Commands Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 0. Mission Launch & Scramble Sorties */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-sky-400/40 space-y-2 md:col-span-2 bg-gradient-to-r from-sky-950/40 via-cyan-950/30 to-slate-900/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sky-300 font-bold text-xs uppercase tracking-wide">
                      <Plane className="w-3.5 h-3.5 text-sky-400" />
                      <span>Mission Launch & Sortie Scramble</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                      HIGH PRIORITY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Instantly calculates CP-SAT optimal fighter sortie package and deploys live aircraft onto the tactical map.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      { phrase: 'Launch mission', action: 'CP-SAT Sortie Scramble' },
                      { phrase: 'Strike target Alpha', action: 'Deep-Strike Penetration' },
                      { phrase: 'Scramble fighter', action: 'Immediate Takeoff' },
                    ].map((item) => (
                      <button
                        key={item.phrase}
                        onClick={() => {
                          setShowVoiceHelp(false);
                          parseVoiceCommand(item.phrase);
                        }}
                        className="text-left px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-sky-950/60 border border-sky-500/30 hover:border-sky-400 text-slate-200 hover:text-white transition-all flex items-center justify-between group cursor-pointer shadow-sm"
                      >
                        <span className="font-mono text-sky-200 group-hover:text-sky-100 font-semibold text-[11px]">
                          "{item.phrase}"
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-sky-300 font-bold">Run ➔</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. SAM Threat Injections */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wide">
                    <Radio className="w-3.5 h-3.5" />
                    <span>SAM Threat Injections</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Instantly deploys pop-up surface-to-air missile threat zones with radar engagement radius.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { phrase: 'Spawn SAM battery', action: 'Pop-Up S-400 Battery Sector' },
                      { phrase: 'Deploy missile threat', action: 'SAM Radar Battery' },
                      { phrase: 'Spawn S-400 radar', action: 'High-altitude denial zone' },
                    ].map((item) => (
                      <button
                        key={item.phrase}
                        onClick={() => {
                          setShowVoiceHelp(false);
                          parseVoiceCommand(item.phrase);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-rose-950/40 border border-rose-500/20 hover:border-rose-400 text-slate-200 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="font-mono text-rose-200 group-hover:text-rose-100 font-semibold">
                          "{item.phrase}"
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-rose-300">Run ➔</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Severe Weather Hazards */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-cyan-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wide">
                    <CloudLightning className="w-3.5 h-3.5" />
                    <span>Weather Hazards</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Inject convective squalls, gale crosswinds, monsoons, or radiation fog across airbases.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { phrase: 'Thunderstorm squall', action: 'Squall line + microburst' },
                      { phrase: 'Gale winds', action: '48kt crosswinds' },
                      { phrase: 'Monsoon downpour', action: 'Heavy precipitation' },
                      { phrase: 'Dense fog', action: 'CAT-III low visibility' },
                      { phrase: 'Clear weather', action: 'Live Open-Meteo observations' },
                    ].map((item) => (
                      <button
                        key={item.phrase}
                        onClick={() => {
                          setShowVoiceHelp(false);
                          parseVoiceCommand(item.phrase);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-cyan-950/40 border border-cyan-500/20 hover:border-cyan-400 text-slate-200 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="font-mono text-cyan-200 group-hover:text-cyan-100 font-semibold">
                          "{item.phrase}"
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-cyan-300">Run ➔</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Airbase & Sortie Emergencies */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wide">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Runways & In-Flight Faults</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Locks runways to test automated divert re-routing or injects aircraft engine failures.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { phrase: 'Lock runway Shakti', action: 'Close Shakti AFS runway' },
                      { phrase: 'Lock runway Trishul', action: 'Close Trishul AFS runway' },
                      { phrase: 'Engine fault', action: 'Turbine flameout on active sortie' },
                    ].map((item) => (
                      <button
                        key={item.phrase}
                        onClick={() => {
                          setShowVoiceHelp(false);
                          parseVoiceCommand(item.phrase);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-amber-950/40 border border-amber-500/20 hover:border-amber-400 text-slate-200 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="font-mono text-amber-200 group-hover:text-amber-100 font-semibold">
                          "{item.phrase}"
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-amber-300">Run ➔</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Autonomous Simulation Workflow */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulation Workflow</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Execute the full autonomous presentation sequence or review side-by-side delta metrics.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { phrase: 'Start 1-click demo', action: 'Autonomous presentation sequence' },
                      { phrase: 'Delta results', action: 'Open Before/After comparison' },
                      { phrase: 'Reset simulation', action: 'Restore baseline readiness' },
                    ].map((item) => (
                      <button
                        key={item.phrase}
                        onClick={() => {
                          setShowVoiceHelp(false);
                          parseVoiceCommand(item.phrase);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-400 text-slate-200 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="font-mono text-emerald-200 group-hover:text-emerald-100 font-semibold">
                          "{item.phrase}"
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-emerald-300">Run ➔</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Footer Action */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <span className="text-slate-400 text-[11px] font-sans">
                  Voice recognition runs locally in the browser with zero external API calls.
                </span>
                <button
                  onClick={() => setShowVoiceHelp(false)}
                  className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold cursor-pointer transition-colors shadow-md"
                >
                  Close Directory
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
