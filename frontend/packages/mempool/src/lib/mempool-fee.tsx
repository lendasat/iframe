import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import MempoolClient, { type RecommendedFees } from "./mempool-client";

interface FeeContextType {
  recommendedFees: RecommendedFees | undefined;
  isLoading: boolean;
  error: Error | null;
  refreshFees: () => Promise<void>;
}

const FeeContext = createContext<FeeContextType | undefined>(undefined);

interface FeeProviderProps {
  children: ReactNode;
  mempoolUrl: string;
}

// Provider component
export const FeeProvider = ({ children, mempoolUrl }: FeeProviderProps) => {
  const [recommendedFees, setRecommendedFees] = useState<RecommendedFees>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFees = useCallback(async () => {
    const client = new MempoolClient(mempoolUrl);
    try {
      setIsLoading(true);
      setError(null);
      const fees = await client.getRecommendedFees();
      setRecommendedFees(fees);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch fees"));
      console.error("Error fetching recommended fees:", err);
    } finally {
      setIsLoading(false);
    }
  }, [mempoolUrl]);

  // Initial fetch
  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const value = {
    recommendedFees,
    isLoading,
    error,
    refreshFees: fetchFees,
  };

  return <FeeContext.Provider value={value}>{children}</FeeContext.Provider>;
};

// Custom hook to use the fee context
export const useFees = () => {
  const context = useContext(FeeContext);
  if (context === undefined) {
    throw new Error("useFees must be used within a FeeProvider");
  }
  return context;
};
