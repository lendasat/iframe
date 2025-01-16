import init, {
  does_wallet_exist,
  get_mnemonic,
  get_next_pk,
  get_xpub,
  is_wallet_loaded,
  load_wallet,
  sign_claim_psbt,
  sign_liquidation_psbt,
} from "browser-wallet";
import type { SignedTransaction } from "browser-wallet";
import { md5 } from "hash-wasm";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

interface WalletContextType {
  isInitialized: boolean;
  isWalletLoaded: boolean;
  doesWalletExist: boolean;
  loadWallet: (passphrase: string) => Promise<void>;
  getMnemonic: () => string;
  getNextPublicKey: () => Promise<string>;
  signClaimPsbt: (psbt: string, collateralDescriptor: string, borrowerPk: string) => Promise<SignedTransaction>;
  signLiquidationPsbt: (psbt: string, collateralDescriptor: string, borrowerPk: string) => Promise<SignedTransaction>;
  getXpub: () => Promise<string>;
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
  email: string;
}

export const WalletProvider = ({ children, email }: WalletProviderProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWalletLoaded, setIsWalletLoaded] = useState(false);
  const [doesWalletExist, setDoesWalletExist] = useState(false);

  useEffect(() => {
    init().then(async () => {
      setIsInitialized(true);
      const key = await md5(email);

      setDoesWalletExist(does_wallet_exist(key));
      setIsWalletLoaded(is_wallet_loaded());
    }).catch((error) => {
      console.log(`Failed initializing wasm library ${error}`);
    });
  }, [email]);

  const loadWallet = async (passphrase: string) => {
    console.log("loading wallet");
    if (isInitialized) {
      const key = await md5(email);
      load_wallet(passphrase, key);
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

  const getNextPublicKey = async () => {
    const key = await md5(email);
    return get_next_pk(key);
  };

  const signClaimPsbt = async (psbt: string, collateralDescriptor: string, borrowerPk: string) => {
    if (isInitialized && isWalletLoaded) {
      return sign_claim_psbt(psbt, collateralDescriptor, borrowerPk);
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const signLiquidationPsbt = async (
    psbt: string,
    collateralDescriptor: string,
    lenderPk: string,
  ) => {
    if (isInitialized && isWalletLoaded) {
      return sign_liquidation_psbt(psbt, collateralDescriptor, lenderPk);
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const getXpub = async () => {
    const key = await md5(email);
    return get_xpub(key);
  };

  const value = {
    isInitialized,
    isWalletLoaded,
    doesWalletExist,
    loadWallet,
    getMnemonic,
    getNextPublicKey,
    signClaimPsbt,
    signLiquidationPsbt,
    getXpub,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export default WalletProvider;
