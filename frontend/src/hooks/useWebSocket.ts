import { useEffect, useRef, useCallback } from "react";
import {
  WS_URL,
  WS_RECONNECT_BASE_DELAY_MS,
  WS_RECONNECT_MAX_DELAY_MS,
  WS_RECONNECT_MAX_ATTEMPTS,
} from "@/utils/constants";
import { getStoredAuth } from "@/api/client";
import { useNotificationStore } from "@/stores/notificationStore";
import type { Notification } from "@/stores/notificationStore";

interface WebSocketMessage {
  type: "notification" | "ping" | "error";
  payload?: Notification;
  message?: string;
}

/**
 * WebSocket hook for real-time notifications with automatic reconnection.
 */
export function useWebSocket(enabled = true): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const connect = useCallback(() => {
    const auth = getStoredAuth();
    if (!auth?.accessToken) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = `${WS_URL}?token=${encodeURIComponent(auth.accessToken)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WebSocketMessage;

        if (msg.type === "notification" && msg.payload) {
          addNotification(msg.payload);
        } else if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;

      // Don't reconnect on intentional close (code 1000) or auth failure (code 4001)
      if (event.code === 1000 || event.code === 4001) return;

      if (reconnectAttemptRef.current < WS_RECONNECT_MAX_ATTEMPTS) {
        const delay = Math.min(
          WS_RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptRef.current),
          WS_RECONNECT_MAX_DELAY_MS,
        );
        reconnectAttemptRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, handling reconnection
    };
  }, [addNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnecting");
      wsRef.current = null;
    }
    reconnectAttemptRef.current = 0;
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return disconnect;
  }, [enabled, connect, disconnect]);
}
