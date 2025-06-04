import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  ReactNode,
} from "react";
import { ChatMessage, ContractUpdate, NotificationMessage } from "./models";

export type NotificationCallback = (notification: NotificationMessage) => void;

export interface NotificationContextValue {
  onNotification: (callback: NotificationCallback) => () => void;
  isConnected: boolean;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

// Create the context
const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

// Provider props
export interface WebSocketNotificationProps {
  children: ReactNode;
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
  debug?: boolean;
}

// Main Provider Component
export function WebSocketNotification({
  children,
  url,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  onConnect,
  onDisconnect,
  onError,
  autoConnect = true,
  debug = false,
}: WebSocketNotificationProps) {
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef<Set<NotificationCallback>>(new Set());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const log = useCallback(
    (...args: Parameters<typeof console.log>) => {
      if (debug) {
        console.log("[WebSocketNotification]", ...args);
      }
    },
    [debug],
  );

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const notification: NotificationMessage = JSON.parse(event.data);
        log("Received notification:", notification);

        // Notify all registered callbacks
        callbacksRef.current.forEach((callback) => {
          try {
            callback(notification);
          } catch (error) {
            console.error(
              "[WebSocketNotification] Error in notification callback:",
              error,
            );
          }
        });
      } catch (error) {
        console.error(
          "[WebSocketNotification] Failed to parse notification message:",
          error,
        );
      }
    },
    [log],
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log("Already connected");
      return;
    }

    try {
      log("Connecting to:", url);
      setConnectionState("connecting");
      const ws = new WebSocket(url);

      ws.onopen = () => {
        log("WebSocket connected");
        setConnectionState("connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        log("WebSocket disconnected:", event.code, event.reason);
        setConnectionState("disconnected");
        setIsConnected(false);
        wsRef.current = null;
        onDisconnect?.();

        // Auto-reconnect if enabled and not a clean close
        if (shouldReconnectRef.current && event.code !== 1000) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocketNotification] WebSocket error:", error);
        setConnectionState("error");
        setIsConnected(false);
        onError?.(error);
        scheduleReconnect();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error(
        "[WebSocketNotification] Failed to create WebSocket connection:",
        error,
      );
      setConnectionState("error");
      scheduleReconnect();
    }
  }, [url, handleMessage, onConnect, onDisconnect, onError, log]);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (
      !shouldReconnectRef.current ||
      reconnectAttemptsRef.current >= maxReconnectAttempts
    ) {
      log(
        "Not reconnecting - shouldReconnect:",
        shouldReconnectRef.current,
        "attempts:",
        reconnectAttemptsRef.current,
      );
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current += 1;
    log(
      `Scheduling reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${reconnectInterval}ms`,
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      if (shouldReconnectRef.current) {
        connect();
      }
    }, reconnectInterval);
  }, [connect, reconnectInterval, maxReconnectAttempts, log]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    log("Disconnecting...");
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setConnectionState("disconnected");
    setIsConnected(false);
  }, [log]);

  // Reconnect (reset attempts and connect)
  const reconnect = useCallback(() => {
    log("Manual reconnect requested");
    reconnectAttemptsRef.current = 0;
    shouldReconnectRef.current = true;
    disconnect();
    setTimeout(connect, 100);
  }, [connect, disconnect, log]);

  // Register notification callback
  const onNotification = useCallback(
    (callback: NotificationCallback) => {
      log("Registering notification callback");
      callbacksRef.current.add(callback);

      // Return cleanup function
      return () => {
        log("Unregistering notification callback");
        callbacksRef.current.delete(callback);
      };
    },
    [log],
  );

  // Effect to handle auto-connect and cleanup
  useEffect(() => {
    if (autoConnect) {
      shouldReconnectRef.current = true;
      connect();
    }

    // Cleanup on unmount
    return () => {
      log("Provider unmounting, cleaning up...");
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, [connect, autoConnect, log]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log("Page hidden");
      } else {
        log("Page visible");
        if (shouldReconnectRef.current && !isConnected) {
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [connect, isConnected, log]);

  const contextValue: NotificationContextValue = {
    onNotification,
    isConnected,
    connectionState,
    connect,
    disconnect,
    reconnect,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook to use notifications
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a WebSocketNotification provider",
    );
  }
  return context;
}

// Convenience hook for specific notification types
export function useNotificationHandlers() {
  const { onNotification, ...rest } = useNotifications();

  const onContractUpdate = useCallback(
    (callback: (data: ContractUpdate) => void) => {
      return onNotification((notification) => {
        if (notification.type === "ContractUpdate") {
          callback(notification.data as ContractUpdate);
        }
      });
    },
    [onNotification],
  );

  const onChatMessage = useCallback(
    (callback: (data: ChatMessage) => void) => {
      return onNotification((notification) => {
        if (notification.type === "ChatMessage") {
          callback(notification.data as ChatMessage);
        }
      });
    },
    [onNotification],
  );

  return {
    onNotification,
    onContractUpdate,
    onChatMessage,
    ...rest,
  };
}
