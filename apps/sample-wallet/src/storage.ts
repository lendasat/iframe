import type { WalletCapabilities } from "@lendasat/lendasat-wallet-bridge";

const STORAGE_KEY = "sample-wallet-private-key";
const CAPABILITIES_STORAGE_KEY = "sample-wallet-capabilities";
const DEFAULT_PRIVATE_KEY =
  "0000000000000000000000000000000000000000000000000000000000000001";

const DEFAULT_CAPABILITIES: WalletCapabilities = {
  bitcoin: {
    signPsbt: true,
    sendBitcoin: false,
  },
  loanAssets: {
    supportedAssets: ["UsdcPol"],
    canReceive: true,
    canSend: false,
  },
  nostr: {
    hasNpub: false,
  },
  ark: {
    canSend: true,
    canReceive: true,
  },
};

export const savePrivateKey = (privateKey: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, privateKey);
  } catch (error) {
    console.error("Failed to save private key to storage:", error);
  }
};

export const loadPrivateKey = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || DEFAULT_PRIVATE_KEY;
  } catch (error) {
    console.error("Failed to load private key from storage:", error);
    return DEFAULT_PRIVATE_KEY;
  }
};

export const clearPrivateKey = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear private key from storage:", error);
  }
};

export const saveCapabilities = (capabilities: WalletCapabilities): void => {
  try {
    localStorage.setItem(CAPABILITIES_STORAGE_KEY, JSON.stringify(capabilities));
  } catch (error) {
    console.error("Failed to save capabilities to storage:", error);
  }
};

export const loadCapabilities = (): WalletCapabilities => {
  try {
    const stored = localStorage.getItem(CAPABILITIES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return DEFAULT_CAPABILITIES;
  } catch (error) {
    console.error("Failed to load capabilities from storage:", error);
    return DEFAULT_CAPABILITIES;
  }
};

export const clearCapabilities = (): void => {
  try {
    localStorage.removeItem(CAPABILITIES_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear capabilities from storage:", error);
  }
};
