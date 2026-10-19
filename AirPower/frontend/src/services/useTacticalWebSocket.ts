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

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Connect through Vite reverse proxy or direct host
    const wsUrl = `${protocol}//${host}/ws`;

    setStatus('CONNECTING');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTED');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'STATE_SNAPSHOT' && payload.data) {
          onStateUpdate(payload.data);
        } else if (payload.type === 'EVENT_ALERT' && payload.data) {
          onEventAlert(payload.data);
        } else if (payload.type === 'WEATHER_UPDATE' && onWeatherUpdate) {
          onWeatherUpdate(payload.data);
        }
      } catch (e) {
        // Plain text pong
      }
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
      wsRef.current = null;
      // Exponential backoff reconnect
      const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 10000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, backoff);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [onStateUpdate, onEventAlert, onWeatherUpdate]);

  useEffect(() => {
    connect();

    // Heartbeat ping interval
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { status, reconnect: connect };
}
