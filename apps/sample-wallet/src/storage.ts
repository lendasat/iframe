const STORAGE_KEY = "sample-wallet-private-key";
const DEFAULT_PRIVATE_KEY =
  "0000000000000000000000000000000000000000000000000000000000000001";

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
