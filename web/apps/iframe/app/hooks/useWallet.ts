import { useEffect, useRef, useState } from "react";
import { LendasatClient } from "@lendasat/wallet-bridge";

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
    const client = new LendasatClient();
    clientRef.current = client;
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
          client.getAddress(),
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
            `Failed to fetch wallet info: ${errors.map((e) => e.status === "rejected" ? e.reason : "").join(", ")}`,
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
