import { useEffect, useRef, useState } from "react";
import {
  AddressType,
  LendasatClient,
  type LoanAsset,
} from "@lendasat/lendasat-wallet-bridge";

/**
 * React hook to interact with the parent wallet via the wallet bridge
 *
 * Usage:
 * ```typescript
 * const { client, isConnected } = useWallet();
 *
 * // Get wallet info
 * const publicKey = await client?.getPublicKey();
 * const path = await client?.getDerivationPath();
 * const npub = await client?.getNpub();
 *
 * // Sign PSBT
 * const signed = await client?.signPsbt(psbtBase64);
 * ```
 */
export function useWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<LendasatClient | null>(null);

  useEffect(() => {
    // Initialize client only in browser
    if (typeof window === "undefined") {
      return;
    }

    // Check if we're running in an iframe
    const isIframe = window.self !== window.top;
    if (!isIframe) {
      console.warn("Not running in an iframe, wallet bridge will not work");
      return;
    }

    // Create client
    clientRef.current = new LendasatClient();
    setIsConnected(true);

    console.log("LendasatClient initialized");

    // Cleanup
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  return {
    client: clientRef.current,
    isConnected,
  };
}

/**
 * Helper hook to get wallet information on mount
 */
export function useWalletInfo() {
  const { client, isConnected } = useWallet();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [derivationPath, setDerivationPath] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [npub, setNpub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !isConnected) {
      return;
    }

    const fetchWalletInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const [pk, path, addr, npubValue] = await Promise.allSettled([
          client.getPublicKey(),
          client.getDerivationPath(),
          client.getAddress(AddressType.BITCOIN),
          client.getNpub().catch(() => null), // npub might not be implemented yet
        ]);

        if (pk.status === "fulfilled") {
          setPublicKey(pk.value);
        }
        if (path.status === "fulfilled") {
          setDerivationPath(path.value);
        }
        if (addr.status === "fulfilled") {
          setAddress(addr.value);
        }
        if (npubValue.status === "fulfilled") {
          setNpub(npubValue.value);
        }

        // Check if any critical errors occurred
        const errors = [pk, path, addr].filter(
          (result) => result.status === "rejected",
        );
        if (errors.length > 0) {
          setError(
            `Failed to fetch wallet info: ${errors.map((e) => (e.status === "rejected" ? e.reason : "")).join(", ")}`,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchWalletInfo();
  }, [client, isConnected]);

  return {
    publicKey,
    derivationPath,
    address,
    npub,
    loading,
    error,
    client,
  };
}

/**
 * Helper hook to get a loan asset address for a specific asset
 *
 * Usage:
 * ```typescript
 * const { address, loading, error, refetch } = useLoanAssetAddress("UsdcPol");
 *
 * // Or lazy load
 * const { address, loading, error, fetchAddress } = useLoanAssetAddress();
 * const addr = await fetchAddress("UsdtEth");
 * ```
 */
export function useLoanAssetAddress(loanAsset?: LoanAsset) {
  const { client, isConnected } = useWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddress = async (asset: LoanAsset): Promise<string> => {
    if (!client) {
      throw new Error("Wallet client not initialized");
    }

    try {
      setLoading(true);
      setError(null);
      const addr = await client.getAddress(AddressType.LOAN_ASSET, asset);
      setAddress(addr);
      return addr;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch if loanAsset is provided
  useEffect(() => {
    if (!client || !isConnected || !loanAsset) {
      return;
    }

    fetchAddress(loanAsset).catch((err) => {
      console.error("Failed to fetch loan asset address:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isConnected, loanAsset]);

  return {
    address,
    loading,
    error,
    fetchAddress,
    refetch: loanAsset ? () => fetchAddress(loanAsset) : undefined,
  };
}
