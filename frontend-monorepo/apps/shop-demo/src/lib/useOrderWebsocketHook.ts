import { useState, useEffect, useRef, useCallback } from "react";
import { Order } from "@/types.ts";

// Hook Configuration
interface UseOrderWebSocketConfig {
  url: string;
  onError?: (error: Event | string) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

// Hook Return Type
interface UseOrderWebSocketReturn {
  order: Order | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

/**
 * A custom React hook for managing WebSocket connections to receive Order updates.
 *
 * @param orderId - The ID of the order to subscribe to
 * @param config - Configuration options for the WebSocket connection
 * @returns An object containing the current order, connection status, any errors, and a reconnect function
 */
export const useOrderWebSocket = (
  orderId: string,
  config: UseOrderWebSocketConfig,
): UseOrderWebSocketReturn => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Store the config in refs to prevent them from causing re-renders
  const urlRef = useRef(config.url);
  const onErrorRef = useRef(config.onError);
  const reconnectAttemptsRef = useRef(config.reconnectAttempts ?? 5);
  const reconnectIntervalRef = useRef(config.reconnectInterval ?? 3000);

  // Update refs when config changes, but don't trigger re-renders
  useEffect(() => {
    urlRef.current = config.url;
    onErrorRef.current = config.onError;
    reconnectAttemptsRef.current = config.reconnectAttempts ?? 5;
    reconnectIntervalRef.current = config.reconnectInterval ?? 3000;
  }, [
    config.url,
    config.onError,
    config.reconnectAttempts,
    config.reconnectInterval,
  ]);

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef<number>(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderIdRef = useRef<string>(orderId);

  // Update orderIdRef when orderId changes
  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (ws.current) {
      ws.current.close();
    }

    // Don't create new connection if we don't have a valid URL
    if (!urlRef.current) {
      setError("WebSocket URL is not defined");
      return;
    }

    try {
      // Create a new WebSocket connection
      // Using the URL directly instead of constructing it with orderId
      const socket = new WebSocket(urlRef.current);
      ws.current = socket;

      // Connection opened
      socket.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectCount.current = 0;
      };

      // Listen for messages
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          console.log(`Received ws message: ${JSON.stringify(message)}`);

          if (typeof message === "object") {
            if (typeof message.payload !== "string") {
              setOrder(message);
            }
          } else if (typeof message === "string") {
            setError(message);
            if (onErrorRef.current) onErrorRef.current(message);
          }
        } catch (err) {
          setError("Failed to parse WebSocket message");
          if (onErrorRef.current)
            onErrorRef.current("Failed to parse WebSocket message");
        }
      };

      // Connection closed
      socket.onclose = (event) => {
        setIsConnected(false);

        // Only attempt to reconnect if it wasn't a clean close
        if (
          !event.wasClean &&
          reconnectCount.current < reconnectAttemptsRef.current
        ) {
          reconnectCount.current += 1;

          if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
          }

          reconnectTimer.current = setTimeout(() => {
            connect();
          }, reconnectIntervalRef.current);
        }
      };

      // Connection error
      socket.onerror = (event) => {
        setError("WebSocket connection error");
        if (onErrorRef.current) onErrorRef.current(event);
      };
    } catch (error) {
      setError("Failed to create WebSocket connection");
      if (onErrorRef.current)
        onErrorRef.current("Failed to create WebSocket connection");
    }
  }, []); // Empty dependency array since we're using refs for all dependencies

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    connect();
  }, [connect]);

  // Set up the connection when the component mounts or when URL changes
  useEffect(() => {
    connect();

    // Clean up the connection when the component unmounts
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }

      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connect, orderId, urlRef]);

  return { order, isConnected, error, reconnect };
};
