import { useEffect, useRef, useState } from "react";
import {
  AddressType,
  LendasatClient,
  type LoanAsset,
  type WalletCapabilities,
} from "@lendasat/lendasat-wallet-bridge";
import type { CollateralAsset } from "@repo/api";

/**
 * React hook to interact with the parent wallet via the wallet bridge
 *
 * Usage:
 * ```typescript
 * const { client, isConnected, capabilities } = useWallet();
 *
 * // Check capabilities
 * if (capabilities?.bitcoin.signPsbt) {
 *   // Show withdraw button
 * }
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
  const [capabilities, setCapabilities] = useState<WalletCapabilities | null>(
    null,
  );
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
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

    // Fetch capabilities
    const fetchCapabilities = async () => {
      if (!clientRef.current) return;

      try {
        setCapabilitiesLoading(true);
        const caps = await clientRef.current.getCapabilities();
        setCapabilities(caps);
        console.log("-------- Wallet capabilities loaded:", caps);
      } catch (err) {
        console.error("Failed to fetch wallet capabilities:", err);
        // Don't set capabilities to null on error - keep it null to indicate unknown
      } finally {
        setCapabilitiesLoading(false);
      }
    };

    fetchCapabilities();

    // Cleanup
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
      setIsConnected(false);
      setCapabilities(null);
    };
  }, []);

  return {
    client: clientRef.current,
    isConnected,
    capabilities,
    capabilitiesLoading,
  };
}

/**
 * Helper hook to get wallet information on mount
 */
export function useWalletInfo() {
  const { client, isConnected, capabilities } = useWallet();
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
      if (!capabilities) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const fetchNpub = capabilities?.nostr.hasNpub || false;

        const [pk, path, addr, npubValue] = await Promise.allSettled([
          client.getPublicKey(),
          client.getDerivationPath(),
          client.getAddress(AddressType.ARK),
          fetchNpub ? client.getNpub() : Promise.resolve(null),
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
            `Failed to fetch wallet info: ${JSON.stringify(errors)} ${errors.map((e) => (e.status === "rejected" ? e.reason : "")).join(", ")}`,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchWalletInfo();
  }, [client, isConnected, capabilities]);

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
 * const { address, loading, error, supported, refetch } = useLoanAssetAddress("UsdcPol");
 *
 * if (!supported) {
 *   return <div>Wallet doesn't support this asset</div>;
 * }
 *
 * // Or lazy load
 * const { address, loading, error, fetchAddress } = useLoanAssetAddress();
 * const addr = await fetchAddress("UsdtEth");
 * ```
 */
export function useLoanAssetAddress(loanAsset?: LoanAsset) {
  const { client, isConnected, capabilities } = useWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if the asset is supported
  const supported =
    !loanAsset ||
    !capabilities ||
    (capabilities.loanAssets.canReceive &&
      capabilities.loanAssets.supportedAssets.includes(loanAsset));

  const fetchAddress = async (asset: LoanAsset): Promise<string | null> => {
    if (!client) {
      throw new Error("Wallet client not initialized");
    }

    // Check if asset is supported
    if (!capabilities) {
      return null;
    }

    if (
      !capabilities.loanAssets.canReceive ||
      !capabilities.loanAssets.supportedAssets.includes(asset)
    ) {
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const addr = await client.getAddress(AddressType.LOAN_ASSET, asset);
      if (!addr) {
        throw new Error(`Wallet returned no address for ${asset}`);
      }
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

  // Auto-fetch if loanAsset is provided and supported
  useEffect(() => {
    if (!client || !isConnected || !loanAsset || !supported) {
      return;
    }

    fetchAddress(loanAsset).catch((err) => {
      console.error("Failed to fetch loan asset address:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isConnected, loanAsset, supported]);

  return {
    address,
    loading,
    error,
    supported,
    fetchAddress,
    refetch: loanAsset ? () => fetchAddress(loanAsset) : undefined,
  };
}

/**
 * Helper hook to get a collateral address for a specific collateral asset type
 *
 * Usage:
 * ```typescript
 * const { address, loading, error, supported, refetch } = useCollateralAddress("ArkadeBtc");
 *
 * if (!supported) {
 *   return <div>Wallet doesn't support this collateral type</div>;
 * }
 *
 * // Or lazy load
 * const { address, loading, error, fetchAddress } = useCollateralAddress();
 * const addr = await fetchAddress("BitcoinBtc");
 * ```
 */
export function useCollateralAddress(collateralAsset?: CollateralAsset) {
  const { client, isConnected, capabilities } = useWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map collateral asset to address type
  const getAddressType = (asset: CollateralAsset): AddressType => {
    switch (asset) {
      case "BitcoinBtc":
        return AddressType.BITCOIN;
      case "ArkadeBtc":
        return AddressType.ARK;
      default:
        throw new Error(`Unknown collateral asset: ${asset}`);
    }
  };

  // Check if the collateral asset is supported
  const supported =
    !collateralAsset ||
    !capabilities ||
    collateralAsset === "BitcoinBtc" ||
    (collateralAsset === "ArkadeBtc" && capabilities.ark.canReceive);

  const fetchAddress = async (
    asset: CollateralAsset,
  ): Promise<string | null> => {
    if (!client) {
      throw new Error("Wallet client not initialized");
    }

    // Check if asset is supported
    if (!capabilities) {
      return null;
    }

    if (
      asset === "ArkadeBtc" &&
      (!capabilities.ark || !capabilities.ark.canReceive)
    ) {
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const addressType = getAddressType(asset);
      const addr = await client.getAddress(addressType);
      if (!addr) {
        throw new Error(`Wallet returned no address for ${asset}`);
      }
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

  // Auto-fetch if collateralAsset is provided and supported
  useEffect(() => {
    if (!client || !isConnected || !collateralAsset || !supported) {
      return;
    }

    fetchAddress(collateralAsset).catch((err) => {
      console.error("Failed to fetch collateral address:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isConnected, collateralAsset, supported]);

  return {
    address,
    loading,
    error,
    supported,
    fetchAddress,
    refetch: collateralAsset ? () => fetchAddress(collateralAsset) : undefined,
  };
}

/**
 * Helper function to check if a specific loan asset is supported by the wallet
 */
export function isAssetSupported(
  capabilities: WalletCapabilities | null,
  asset: LoanAsset,
): boolean {
  if (!capabilities) return false;
  return capabilities.loanAssets.supportedAssets.includes(asset);
}

/**
 * Helper function to check if wallet can receive a specific loan asset
 */
export function canReceiveLoanAsset(
  capabilities: WalletCapabilities | null,
  asset: LoanAsset,
): boolean {
  return (
    isAssetSupported(capabilities, asset) &&
    capabilities?.loanAssets.canReceive === true
  );
}

/**
 * Helper function to check if wallet can send a specific loan asset
 */
export function canSendLoanAsset(
  capabilities: WalletCapabilities | null,
  asset: LoanAsset,
): boolean {
  return (
    isAssetSupported(capabilities, asset) &&
    capabilities?.loanAssets.canSend === true
  );
}

/**
 * Helper function to check if a specific collateral asset is supported by the wallet
 */
export function isCollateralAssetSupported(
  capabilities: WalletCapabilities | null,
  asset: CollateralAsset,
): boolean {
  if (!capabilities) return false;

  switch (asset) {
    case "BitcoinBtc":
      // Bitcoin is always supported
      return true;
    case "ArkadeBtc":
      // Ark support depends on capabilities
      return capabilities.ark?.canReceive === true;
    default:
      return false;
  }
}

/**
 * Helper function to check if wallet can receive a specific collateral asset
 */
export function canReceiveCollateral(
  capabilities: WalletCapabilities | null,
  asset: CollateralAsset,
): boolean {
  return isCollateralAssetSupported(capabilities, asset);
}
