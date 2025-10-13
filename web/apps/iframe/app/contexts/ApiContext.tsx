import { createContext, useContext, useEffect, useState, useRef } from "react";
import { apiClient } from "@repo/api";
import { useWallet } from "~/hooks/useWallet";
import { LoadingOverlay } from "~/components/ui/spinner";

interface ApiContextType {
  isReady: boolean;
  error: string | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { client, isConnected } = useWallet();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    // If we're not in an iframe, show error
    if (typeof window !== "undefined" && window.self === window.top) {
      console.error("Not running in iframe - wallet bridge required");
      setError("This application must be loaded in a wallet iframe");
      return;
    }

    if (!client || !isConnected) {
      console.log("Waiting for wallet bridge connection...", { client: !!client, isConnected });
      return;
    }

    // Prevent multiple initialization attempts
    if (initAttemptedRef.current) {
      return;
    }
    initAttemptedRef.current = true;

    const initApiKey = async () => {
      try {
        console.log("Fetching API key from wallet bridge...");

        // Add a timeout to prevent hanging forever
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("API key fetch timed out after 10 seconds")), 10000);
        });

        const apiKeyPromise = client.getApiKey();
        const apiKey = await Promise.race([apiKeyPromise, timeoutPromise]) as string;

        console.log(`API Key received: ${apiKey.substring(0, 20)}...`);
        apiClient.setApiKey(apiKey);
        setIsReady(true);
        console.log("API client ready with authenticated key");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to initialize wallet bridge: ${errorMessage}`);
        console.error("Failed to initialize API key:", errorMessage);
      }
    };

    initApiKey();
  }, [client, isConnected]);

  // Show error page if initialization failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Wallet Bridge Error
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {error}
            </p>
            <p className="text-xs text-gray-400">
              Please ensure this iframe is properly embedded in a compatible wallet application.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while initializing
  if (!isReady) {
    return <LoadingOverlay message="Connecting to wallet..." />;
  }

  return (
    <ApiContext.Provider value={{ isReady, error }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return context;
}
