import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import init, {
  does_wallet_exist,
  get_mnemonic,
  get_next_pk,
  get_xpub,
  is_wallet_loaded,
  load_wallet,
  new_wallet,
  sign_claim_psbt,
} from "browser-wallet";

interface WalletContextType {
  isInitialized: boolean;
  isWalletLoaded: boolean;
  doesWalletExist: boolean;
  createWallet: (passphrase: string, network: string) => void;
  loadWallet: (passphrase: string) => void;
  getMnemonic: () => string;
  getNextPublicKey: () => string;
  signClaimPsbt: (psbt: string, collateralDescriptor: string, pk: string) => string;
  getXpub: () => string;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
  username: string;
}

export const WalletProvider = ({ children, username }: WalletProviderProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoaded, setIsWalletLoaded] = useState(false);
  const [doesWalletExist, setDoesWalletExist] = useState(false);

  useEffect(() => {
    init().then(() => {
      setIsInitialized(true);
      setDoesWalletExist(does_wallet_exist(username));
      setIsWalletLoaded(is_wallet_loaded());
    }).catch((error) => {
      console.log(`Failed initializing wasm library ${error}`);
    });
  }, [username]);

  const createWallet = (passphrase: string, network: string) => {
    if (isInitialized) {
      new_wallet(passphrase, network, username);
      setDoesWalletExist(true);
      setIsWalletLoaded(true);
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const loadWallet = (passphrase: string) => {
    console.log("loading wallet");
    if (isInitialized) {
      load_wallet(passphrase, username);
      setIsWalletLoaded(true);
      console.log("wallet loaded successfully");
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const getMnemonic = () => {
    if (isInitialized && isWalletLoaded) {
      return get_mnemonic();
    }
    throw Error("Wallet not initialized");
  };

  const getNextPublicKey = () => {
    if (isInitialized && isWalletLoaded) {
      return get_next_pk();
    } else if (!isInitialized) {
      throw Error("Wallet not initialized");
    } else {
      throw Error("Wallet not loaded");
    }
  };

  const signClaimPsbt = (psbt: string, collateralDescriptor: string, pk: string) => {
    if (isInitialized && isWalletLoaded) {
      return sign_claim_psbt(psbt, collateralDescriptor, pk, username);
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const getXpub = () => {
    if (!isInitialized) {
      throw Error("Wallet not initialized");
    }

    if (!doesWalletExist) {
      throw Error("Wallet does not exist");
    }

    return get_xpub(username);
  };

  const value = {
    isInitialized,
    isWalletLoaded,
    doesWalletExist,
    createWallet,
    loadWallet,
    getMnemonic,
    getNextPublicKey,
    signClaimPsbt,
    getXpub,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export default WalletProvider;
