import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  RotateCcw,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Database,
  Wrench,
  Plane,
  CloudRain,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Terminal,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import type {
  AssistantChatMessage,
  AssistantChatResponse,
  StructuredRecordItem,
  SuggestedQuestionCategory,
  OperationMetadata,
} from '../types';
import {
  sendAssistantChat,
  fetchSuggestedQuestions,
  fetchAssistantOperations,
} from '../services/api';

interface AIOperationsAssistantProps {
  onNavigateToView: (view: any, targetId?: string) => void;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseMeta?: AssistantChatResponse;
}

const CHAT_STORAGE_KEY = 'airpower_assistant_chat_history';
const SESSION_STORAGE_KEY = 'airpower_assistant_session_id';

export const AIOperationsAssistant: React.FC<AIOperationsAssistantProps> = ({
  onNavigateToView,
}) => {
  const [messages, setMessages] = useState<MessageItem[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load chat history from localStorage:', e);
    }
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {
      console.warn('Failed to load session id from localStorage:', e);
    }
    return `SES-${Date.now().toString(36).toUpperCase()}`;
  });
  const [suggestedCategories, setSuggestedCategories] = useState<SuggestedQuestionCategory[]>([]);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [operationsCatalog, setOperationsCatalog] = useState<OperationMetadata[]>([]);
  const [showOperationsDrawer, setShowOperationsDrawer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history to localStorage:', e);
    }
  }, [messages]);

  // Sync sessionId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } catch (e) {
      console.warn('Failed to save session id to localStorage:', e);
    }
  }, [sessionId]);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load suggested questions and operations catalog on mount
  useEffect(() => {
    fetchSuggestedQuestions()
      .then((res) => {
        if (res && res.categories) {
          setSuggestedCategories(res.categories);
        }
      })
      .catch((err) => console.warn('Could not load suggested questions:', err));

    fetchAssistantOperations()
      .then((res) => {
        if (res && Array.isArray(res)) {
          setOperationsCatalog(res);
        }
      })
      .catch((err) => console.warn('Could not load operations catalog:', err));
  }, []);

  // Submit question
  const handleSend = async (questionToSend?: string) => {
    const text = (questionToSend !== undefined ? questionToSend : inputText).trim();
    if (!text || isLoading) return;

    const userMsgId = `MSG-U-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const userMessage: MessageItem = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: userTimestamp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setErrorMessage(null);
    setIsLoading(true);

    // Build conversation history for context
    const historyPayload: AssistantChatMessage[] = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      operation_used: m.responseMeta?.operation_used,
      record_count: m.responseMeta?.total_matching_records,
    }));

    try {
      const response = await sendAssistantChat({
        question: text,
        conversation_history: historyPayload,
        session_id: sessionId,
        max_records: 20,
      });

      const assistantMsgId = `MSG-A-${Date.now()}`;
      const assistantTimestamp = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const assistantMessage: MessageItem = {
        id: assistantMsgId,
        role: 'assistant',
        content: response.answer_markdown,
        timestamp: assistantTimestamp,
        responseMeta: response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Assistant request failed. Please verify connection.');
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartNewSession = () => {
    setMessages([]);
    setErrorMessage(null);
    const newSession = `SES-${Date.now().toString(36).toUpperCase()}`;
    setSessionId(newSession);
    setInputText('');
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.setItem(SESSION_STORAGE_KEY, newSession);
    } catch (e) {
      console.warn('Failed to reset storage:', e);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setErrorMessage(null);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear chat storage:', e);
    }
  };

  const renderCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Wrench':
        return <Wrench className="w-3.5 h-3.5 text-amber-400" />;
      case 'Database':
        return <Database className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Plane':
        return <Plane className="w-3.5 h-3.5 text-emerald-400" />;
      case 'CloudRain':
        return <CloudRain className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
      case 'OVERDUE':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'WARNING':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'INFO':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'NOMINAL':
      case 'READY':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#070D18] text-slate-100 overflow-hidden select-none font-sans relative">
      {/* 1. Assistant Top Control Header */}
      <div className="h-14 px-4 sm:px-6 glass-panel border-b border-cyan-500/20 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold font-mono tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-400 bg-clip-text text-transparent">
                AI OPERATIONS ASSISTANT
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                READ-ONLY VERIFIED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Controlled natural-language query interface for operational fleet, maintenance, weather & data trust
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowOperationsDrawer(!showOperationsDrawer)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Inspect approved read-only operations allowlist"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">ALLOWLIST</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950 border border-cyan-800 text-cyan-300">
              {operationsCatalog.length || 11}
            </span>
          </button>

          <button
            onClick={handleStartNewSession}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Start new conversation session"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">NEW SESSION</span>
          </button>

          <button
            onClick={handleClearChat}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-700/60 transition-all cursor-pointer"
            title="Clear visible chat thread"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Content Canvas: Conversation Thread + Optional Operations Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Thread */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-6 space-y-6">
            {/* Empty State: Shown when no messages */}
            {messages.length === 0 && (
              <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-6">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-mono tracking-wide text-white">
                    AirPower Operations Decision Copilot
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                    Ask natural-language questions about actual synthetic fleet data, maintenance schedules,
                    telemetry freshness, inventory levels, and meteorological advisories.
                  </p>
                </div>

                {/* Categorized Suggested Questions Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      SUGGESTED OPERATIONAL INQUIRIES
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Click any card to execute query
                    </span>
                  </div>

                  {/* Category Pills */}
                  {suggestedCategories.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {suggestedCategories.map((cat, idx) => (
                        <button
                          key={cat.category}
                          onClick={() => setSelectedCategoryIndex(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                            selectedCategoryIndex === idx
                              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                              : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {renderCategoryIcon(cat.icon)}
                          {cat.category}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Questions Grid for Selected Category */}
                  {suggestedCategories[selectedCategoryIndex] && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {suggestedCategories[selectedCategoryIndex].questions.map((q) => (
                        <div
                          key={q.text}
                          onClick={() => handleSend(q.text)}
                          className="glass-panel p-3.5 rounded-xl border border-slate-800 hover:border-cyan-500/40 bg-slate-900/40 hover:bg-slate-900/80 transition-all cursor-pointer group flex flex-col justify-between space-y-2 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-slate-200 group-hover:text-cyan-300 font-medium leading-relaxed">
                              "{q.text}"
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                          <div className="text-[10px] font-mono text-cyan-500/70 flex items-center gap-1">
                            <code>{q.operation}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Security & Scope Guarantee Badge */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-cyan-900/30 flex items-start gap-3 text-xs text-slate-400">
                  <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="text-slate-200 font-mono tracking-wide">
                      READ-ONLY ARCHITECTURE GUARANTEE
                    </strong>
                    <p className="text-[11px] leading-relaxed">
                      The AI Assistant operates through an allowlisted read-only service with bounded limits.
                      It has zero write permissions and cannot modify fleet statuses, deploy sorties, or execute
                      arbitrary database commands. All factual statements derive strictly from verified records.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Messages Thread */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-4xl mx-auto flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* User Message */}
                {msg.role === 'user' && (
                  <div className="max-w-2xl space-y-1">
                    <div className="flex items-center justify-end gap-2 text-[10px] font-mono text-slate-500 px-1">
                      <span>COMMANDER</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-900/40 via-sky-950/50 to-slate-900 border border-cyan-500/30 text-slate-100 text-xs sm:text-sm shadow-md">
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Assistant Message */}
                {msg.role === 'assistant' && (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 px-1">
                      <div className="flex items-center gap-1 text-cyan-400 font-bold">
                        <Bot className="w-3.5 h-3.5" />
                        <span>AI OPERATIONS ASSISTANT</span>
                      </div>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                      {msg.responseMeta && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">
                            Latency: {msg.responseMeta.execution_time_ms}ms
                          </span>
                        </>
                      )}
                    </div>

                    <div className="glass-panel p-5 rounded-2xl rounded-tl-sm border border-cyan-500/25 bg-slate-950/80 space-y-4 shadow-xl">
                      {/* Operation Executed Banner */}
                      {msg.responseMeta && (
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">
                              QUERY EXECUTED:
                            </span>
                            <span className="text-cyan-300 font-bold">
                              {msg.responseMeta.operation_display_name}
                            </span>
                            <span className="text-slate-600">|</span>
                            <code className="text-[11px] text-cyan-500">
                              {msg.responseMeta.operation_used}()
                            </code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-950 border border-cyan-700/50 text-cyan-300 font-bold">
                              {msg.responseMeta.total_matching_records} MATCHES
                            </span>
                            {msg.responseMeta.navigation_link && (
                              <button
                                onClick={() =>
                                  onNavigateToView(msg.responseMeta!.navigation_link)
                                }
                                className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                OPEN {msg.responseMeta.navigation_link}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Markdown Answer Text */}
                      <div className="prose prose-invert prose-xs sm:prose-sm max-w-none text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                        {msg.content}
                      </div>

                      {/* Structured Records Table */}
                      {msg.responseMeta &&
                        msg.responseMeta.returned_records.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-800/80">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5" />
                                MATCHING EVIDENCE RECORDS (
                                {msg.responseMeta.returned_records.length})
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                Freshness: {msg.responseMeta.data_freshness_timestamp}
                              </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                              <table className="w-full text-left text-xs font-mono">
                                <thead>
                                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[10px] uppercase">
                                    <th className="px-3 py-2">Record ID</th>
                                    <th className="px-3 py-2">Resource / Title</th>
                                    <th className="px-3 py-2">Severity</th>
                                    <th className="px-3 py-2">Match Reason</th>
                                    <th className="px-3 py-2 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                  {msg.responseMeta.returned_records.map((rec) => (
                                    <tr
                                      key={rec.record_id}
                                      className="hover:bg-cyan-950/20 transition-colors"
                                    >
                                      <td className="px-3 py-2.5 font-bold text-cyan-300">
                                        {rec.record_id}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-200">
                                        <div className="font-semibold">{rec.title}</div>
                                        <div className="text-[10px] text-slate-400">
                                          {rec.category}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadgeClass(
                                            rec.severity
                                          )}`}
                                        >
                                          {rec.severity}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-[11px] text-slate-300 font-sans max-w-xs md:max-w-md">
                                        {rec.match_reason}
                                      </td>
                                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                        {rec.target_view && (
                                          <button
                                            onClick={() =>
                                              onNavigateToView(
                                                rec.target_view,
                                                rec.target_id || rec.record_id
                                              )
                                            }
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/40 text-cyan-300 text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                                            title={`Open record in ${rec.target_view}`}
                                          >
                                            View
                                            <ArrowRight className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      {/* Suggested Follow-up Inquiries */}
                      {msg.responseMeta &&
                        msg.responseMeta.suggested_followups &&
                        msg.responseMeta.suggested_followups.length > 0 && (
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-cyan-400" />
                              Follow-up:
                            </span>
                            {msg.responseMeta.suggested_followups.map((fText) => (
                              <button
                                key={fText}
                                onClick={() => handleSend(fText)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-200 transition-all cursor-pointer font-sans"
                              >
                                "{fText}"
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="max-w-4xl mx-auto flex items-center gap-3 p-4 rounded-xl bg-slate-950/60 border border-cyan-500/20 text-cyan-400 font-mono text-xs">
                <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <div className="space-y-0.5">
                  <div className="font-bold tracking-wider">
                    EXECUTING CONTROLLED READ-ONLY QUERY...
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Evaluating domain constraints and compiling factual evidence
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="max-w-4xl mx-auto p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[10px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 3. Input Textarea Bar */}
          <div className="p-4 sm:p-5 glass-panel border-t border-cyan-500/20 bg-slate-950/90 shrink-0 z-10">
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="relative flex items-center rounded-2xl bg-slate-900/90 border border-slate-700/80 focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question (e.g., 'Which maintenance work orders are overdue?', 'Summarise inventory shortages', 'Latest weather alerts')..."
                  rows={2}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none resize-none font-sans"
                />
                <div className="pr-3 flex items-center gap-2">
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputText.trim() || isLoading}
                    className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-bold transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:shadow-none"
                    title="Send inquiry (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 text-[10px] font-mono text-slate-500">
                <span>
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Shift + Enter</kbd> for new line
                </span>
                <span className="hidden sm:inline">
                  Session: <span className="text-cyan-400">{sessionId}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Side Allowlist Drawer (Toggled by Allowlist button) */}
        {showOperationsDrawer && (
          <div className="w-80 md:w-96 glass-panel border-l border-cyan-500/20 bg-slate-950/95 flex flex-col z-20 shrink-0">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-mono font-bold text-slate-200">
                  APPROVED OPERATIONS ALLOWLIST
                </h4>
              </div>
              <button
                onClick={() => setShowOperationsDrawer(false)}
                className="text-slate-400 hover:text-white text-xs font-mono p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                The AI Operations Assistant evaluates user inquiries strictly against these {operationsCatalog.length} approved read-only operations.
              </p>

              {operationsCatalog.map((op) => (
                <div
                  key={op.operation_name}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 text-[11px]">
                      {op.display_name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {op.target_module}
                    </span>
                  </div>
                  <code className="text-[10px] text-slate-400 block font-mono">
                    {op.operation_name}()
                  </code>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    {op.description}
                  </p>
                  {op.example_questions.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-500 uppercase block">
                        Example:
                      </span>
                      <button
                        onClick={() => {
                          handleSend(op.example_questions[0]);
                          setShowOperationsDrawer(false);
                        }}
                        className="text-[10px] text-cyan-400 hover:underline text-left block"
                      >
                        "{op.example_questions[0]}"
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
