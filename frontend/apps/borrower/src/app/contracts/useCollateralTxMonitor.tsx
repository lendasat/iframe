import { useEffect, useRef, useState, useCallback } from "react";
import {
  useHttpClientBorrower,
  ContractStatus,
  GetCollateralTransactionsResponse,
} from "@frontend/http-client-borrower";

interface UseCollateralTxMonitorOptions {
  contractId: string;
  contractStatus: ContractStatus;
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
}

interface UseCollateralTxMonitorResult {
  data: GetCollateralTransactionsResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  contractStatus?: ContractStatus;
}

// Statuses where we should monitor for collatearl transactions. Once the collateral is confirmed
// this feature is not that useful.
const MONITORABLE_STATUSES = [ContractStatus.Approved];

export const useCollateralTxMonitor = ({
  contractId,
  contractStatus,
  enabled = true,
  pollingInterval = 30000, // 30 seconds default
}: UseCollateralTxMonitorOptions): UseCollateralTxMonitorResult => {
  const { getCollateralTransactions } = useHttpClientBorrower();
  const [data, setData] = useState<GetCollateralTransactionsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);

  const shouldMonitor =
    enabled && MONITORABLE_STATUSES.includes(contractStatus);

  const fetchCollateralTransactions = useCallback(async () => {
    if (!shouldMonitor) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await getCollateralTransactions(contractId);
      setData(response);
      lastUpdatedRef.current = new Date();

      // Check if the contract status from the response indicates we should stop monitoring
      if (!MONITORABLE_STATUSES.includes(response.contract_status)) {
        console.log(
          `Contract ${contractId} status changed to ${response.contract_status}, stopping collateral TX monitoring`,
        );
        return false; // Signal to stop polling
      }

      return true; // Continue polling
    } catch (err) {
      // Check if it's a 501 Not Implemented error
      if (
        (err instanceof Error && err.message.includes("501")) ||
        (err instanceof Error &&
          err.message.toLowerCase().includes("not implemented"))
      ) {
        console.log(
          `Collateral TX monitoring not available for contract ${contractId} (501 error), stopping polling`,
        );
        setError("Collateral TX monitoring not available");
        return false; // Stop polling
      }

      console.error(
        `Error fetching collateral transactions for contract ${contractId}:`,
        err,
      );
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch collateral transactions",
      );
      return true; // Continue polling despite error (might be temporary)
    } finally {
      setLoading(false);
    }
  }, [contractId, getCollateralTransactions, shouldMonitor]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!shouldMonitor) {
      return;
    }

    // Initial fetch
    fetchCollateralTransactions().then((shouldContinue) => {
      if (!shouldContinue) {
        return;
      }

      // Set up interval for subsequent fetches
      intervalRef.current = setInterval(async () => {
        const shouldContinue = await fetchCollateralTransactions();
        if (!shouldContinue && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, pollingInterval);
    });
  }, [fetchCollateralTransactions, pollingInterval, shouldMonitor]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Effect to manage polling lifecycle
  useEffect(() => {
    if (shouldMonitor) {
      startPolling();
    } else {
      stopPolling();
      // Clear data when not monitoring
      setData(null);
      setError(null);
      lastUpdatedRef.current = null;
    }

    return () => {
      stopPolling();
    };
  }, [shouldMonitor, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    data,
    loading,
    error,
    lastUpdated: lastUpdatedRef.current,
    contractStatus: data?.contract_status,
  };
};
