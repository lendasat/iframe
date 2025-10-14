import { createContext, useContext, useEffect, useState, useRef } from "react";
import { apiClient } from "@repo/api";
import { useWallet } from "~/hooks/useWallet";
import { LoadingOverlay } from "~/components/ui/spinner";
import { useNavigate } from "react-router";

interface ApiContextType {
  isReady: boolean;
  error: string | null;
  needsRegistration: boolean;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { client, isConnected } = useWallet();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
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
      console.log("Waiting for wallet bridge connection...", {
        client: !!client,
        isConnected,
      });
      return;
    }

    // Prevent multiple initialization attempts
    if (initAttemptedRef.current) {
      return;
    }
    initAttemptedRef.current = true;

    const initAuth = async () => {
      try {
        console.log("Starting challenge-response authentication...");

        // Get public key from wallet
        const pubkey = await client.getPublicKey();

        // 1. Try to login using challenge-response
        try {
          // Get challenge from server
          const { challenge } = await apiClient.getRegisterChallenge(pubkey);
          console.log(`Challenge received: ${challenge}`);

          // Sign the challenge using the wallet
          const signature = await client.signMessage(challenge);
          console.log(`Challenge signed: ${signature.substring(0, 20)}...`);

          // Verify signature and get JWT token
          const response = await apiClient.login({
            pubkey,
            challenge,
            signature,
          });
          console.log("Login successful!");

          // Set the JWT token for authenticated requests
          apiClient.setToken(response.token);

          // Store user info
          localStorage.setItem("user", JSON.stringify(response.user));

          setIsReady(true);
          console.log("API client ready with authenticated session");
        } catch (loginError) {
          console.log("Login failed, user needs to register:", loginError);

          // 2. If login fails, redirect to registration
          setNeedsRegistration(true);
          setIsReady(true); // Still set ready so app can render register page
          navigate("/");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to authenticate: ${errorMessage}`);
        console.error("Failed to authenticate:", errorMessage);
      }
    };

    initAuth();
  }, [client, isConnected, navigate]);

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
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <p className="text-xs text-gray-400">
              Please ensure this iframe is properly embedded in a compatible
              wallet application.
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
    <ApiContext.Provider value={{ isReady, error, needsRegistration }}>
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
