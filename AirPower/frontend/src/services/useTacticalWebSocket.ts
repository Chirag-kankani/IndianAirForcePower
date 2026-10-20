import { useEffect, useRef, useState, useCallback } from 'react';
import { StateSnapshot } from '../types';

export type WSConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

interface WebSocketHookProps {
  onStateUpdate: (snapshot: StateSnapshot) => void;
  onEventAlert: (alert: {
    event_id: string;
    event_type: string;
    message: string;
    retasking_actions: any[];
  }) => void;
  onWeatherUpdate?: (data: any) => void;
}

export function useTacticalWebSocket({ onStateUpdate, onEventAlert, onWeatherUpdate }: WebSocketHookProps) {
  const [status, setStatus] = useState<WSConnectionStatus>('CONNECTING');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttempts = useRef(0);
  const isUnmountedRef = useRef(false);

  // Store callbacks in ref to avoid reconnecting on every render
  const callbacksRef = useRef({ onStateUpdate, onEventAlert, onWeatherUpdate });
  useEffect(() => {
    callbacksRef.current = { onStateUpdate, onEventAlert, onWeatherUpdate };
  }, [onStateUpdate, onEventAlert, onWeatherUpdate]);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    setStatus('CONNECTING');
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setStatus('CONNECTED');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const cb = callbacksRef.current;
          if (payload.type === 'STATE_SNAPSHOT' && payload.data) {
            cb.onStateUpdate(payload.data);
          } else if (payload.type === 'EVENT_ALERT' && payload.data) {
            cb.onEventAlert(payload.data);
          } else if (payload.type === 'WEATHER_UPDATE' && cb.onWeatherUpdate) {
            cb.onWeatherUpdate(payload.data);
          }
        } catch (e) {
          // Plain text pong or non-JSON
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setStatus('DISCONNECTED');
        wsRef.current = null;

        // Exponential backoff reconnect (min 2s, max 10s)
        const backoff = Math.min(2000 * Math.pow(1.5, reconnectAttempts.current), 10000);
        reconnectAttempts.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) connect();
        }, backoff);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (err) {
      console.warn('Tactical WebSocket connection failed:', err);
      setStatus('DISCONNECTED');
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    // Heartbeat ping interval
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send('ping');
        } catch (e) {}
      }
    }, 15000);

    return () => {
      isUnmountedRef.current = true;
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { status, reconnect: connect };
}
