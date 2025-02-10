import {
  IbanTransferDetails,
  SignedTransaction,
  SwiftTransferDetails,
} from "browser-wallet";
import init, {
  derive_nostr_room_pk,
  does_wallet_exist,
  encrypt_fiat_loan_details,
  get_mnemonic,
  get_next_pk,
  get_nsec,
  get_xpub,
  InnerFiatLoanDetails,
  is_wallet_loaded,
  load_wallet,
  sign_claim_psbt,
  sign_liquidation_psbt,
  decrypt_fiat_loan_details,
} from "browser-wallet";
import { md5 } from "hash-wasm";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  FiatLoanDetails as ReactFiatLoanDetails,
  InnerFiatLoanDetails as ReactInnerFiatLoanDetails,
} from "@frontend-monorepo/base-http-client";

interface WalletContextType {
  isInitialized: boolean;
  isWalletLoaded: boolean;
  doesWalletExist?: boolean;
  loadWallet: (passphrase: string) => Promise<void>;
  getMnemonic: () => string;
  getNsec: () => string;
  getPubkeyFromContract: (passphrase: string) => string;
  getNextPublicKey: () => Promise<string>;
  signClaimPsbt: (
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
  ) => Promise<SignedTransaction>;
  signLiquidationPsbt: (
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
  ) => Promise<SignedTransaction>;
  getXpub: () => Promise<string>;
  encryptFiatLoanDetailsBorrower: (
    details: ReactInnerFiatLoanDetails,
    counterpartyXpub: string,
  ) => Promise<ReactFiatLoanDetails>;
  encryptFiatLoanDetailsLender: (
    details: ReactInnerFiatLoanDetails,
    counterpartyXpub: string,
  ) => Promise<ReactFiatLoanDetails>;
  decryptFiatLoanDetails: (
    details: ReactInnerFiatLoanDetails,
    counterpartyXpub: string,
  ) => Promise<ReactInnerFiatLoanDetails>;
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
  const [doesWalletExist, setDoesWalletExist] = useState<boolean | undefined>(
    undefined,
  );

  useEffect(() => {
    init()
      .then(async () => {
        setIsInitialized(true);
        const key = await md5(email);

        setDoesWalletExist(does_wallet_exist(key));
        setIsWalletLoaded(is_wallet_loaded());
      })
      .catch((error) => {
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

  const getNsec = () => {
    if (isInitialized && isWalletLoaded) {
      return get_nsec();
    }
    throw Error("Wallet not initialized");
  };

  const getPubkeyFromContract = (contract: string) => {
    return derive_nostr_room_pk(contract);
  };

  const getNextPublicKey = async () => {
    const key = await md5(email);
    return get_next_pk(key);
  };

  const signClaimPsbt = async (
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
  ) => {
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

  const encryptFiatLoanDetailsBorrower = async (
    details: ReactInnerFiatLoanDetails,
    counterpartyXpub: string,
  ) => {
    return encryptFiatLoanDetails(details, counterpartyXpub, true);
  };
  const encryptFiatLoanDetailsLender = async (
    details: ReactInnerFiatLoanDetails,
    counterpartyXpub: string,
  ) => {
    return encryptFiatLoanDetails(details, counterpartyXpub, false);
  };

  const encryptFiatLoanDetails = async (
    details: ReactInnerFiatLoanDetails,
    counterpartyXpub: string,
    isBorrower: boolean,
  ) => {
    let inputIbanTransferDetails = undefined;

    if (details.iban_transfer_details) {
      inputIbanTransferDetails = new IbanTransferDetails(
        details.iban_transfer_details.iban,
        details.iban_transfer_details.bic,
      );
    }

    let inputSwiftTransferDetails = undefined;
    if (details.swift_transfer_details) {
      inputSwiftTransferDetails = new SwiftTransferDetails(
        details.swift_transfer_details.swift_or_bic,
        details.swift_transfer_details.account_number,
      );
    }

    const inputInnerFiatLoanDetails = new InnerFiatLoanDetails(
      inputIbanTransferDetails,
      inputSwiftTransferDetails,
      details.bank_name,
      details.bank_address,
      details.bank_country,
      details.purpose_of_remittance,
      details.full_name,
      details.address,
      details.city,
      details.post_code,
      details.country,
      details.comments,
    );

    const fiatLoanDetails = await encrypt_fiat_loan_details(
      inputInnerFiatLoanDetails,
      counterpartyXpub,
    );
    let iban_transfer_details = undefined;
    if (fiatLoanDetails.inner.iban_transfer_details) {
      iban_transfer_details = {
        iban: fiatLoanDetails.inner.iban_transfer_details.iban,
        bic: fiatLoanDetails.inner.iban_transfer_details.bic,
      };
    }

    let swift_transfer_details = undefined;
    if (fiatLoanDetails.inner.swift_transfer_details) {
      swift_transfer_details = {
        account_number:
          fiatLoanDetails.inner.swift_transfer_details.account_number,
        swift_or_bic: fiatLoanDetails.inner.swift_transfer_details.bic_or_swift,
      };
    }

    const reactInnerType: ReactInnerFiatLoanDetails = {
      iban_transfer_details,
      swift_transfer_details,
      bank_name: fiatLoanDetails.inner.bank_name,
      bank_address: fiatLoanDetails.inner.bank_address,
      bank_country: fiatLoanDetails.inner.bank_country,
      purpose_of_remittance: fiatLoanDetails.inner.purpose_of_remittance,
      full_name: fiatLoanDetails.inner.full_name,
      address: fiatLoanDetails.inner.address,
      city: fiatLoanDetails.inner.city,
      post_code: fiatLoanDetails.inner.post_code,
      country: fiatLoanDetails.inner.country,
      comments: fiatLoanDetails.inner.comments,
    };

    if (isBorrower) {
      return {
        details: reactInnerType,
        encrypted_encryption_key_borrower:
          fiatLoanDetails.encrypted_encryption_key_own,
        encrypted_encryption_key_lender:
          fiatLoanDetails.encrypted_encryption_key_counterparty,
      };
    } else {
      return {
        details: reactInnerType,
        encrypted_encryption_key_borrower:
          fiatLoanDetails.encrypted_encryption_key_counterparty,
        encrypted_encryption_key_lender:
          fiatLoanDetails.encrypted_encryption_key_own,
      };
    }
  };

  const decryptFiatLoanDetails = async (
    details: ReactInnerFiatLoanDetails,
    ownEncryptedEncryptionKey: string,
  ) => {
    let inputIbanTransferDetails = undefined;

    if (details.iban_transfer_details) {
      inputIbanTransferDetails = new IbanTransferDetails(
        details.iban_transfer_details.iban,
        details.iban_transfer_details.bic,
      );
    }

    let inputSwiftTransferDetails = undefined;
    if (details.swift_transfer_details) {
      inputSwiftTransferDetails = new SwiftTransferDetails(
        details.swift_transfer_details.swift_or_bic,
        details.swift_transfer_details.account_number,
      );
    }

    const inputInnerFiatLoanDetails = new InnerFiatLoanDetails(
      inputIbanTransferDetails,
      inputSwiftTransferDetails,
      details.bank_name,
      details.bank_address,
      details.bank_country,
      details.purpose_of_remittance,
      details.full_name,
      details.address,
      details.city,
      details.post_code,
      details.country,
      details.comments,
    );

    const fiatLoanDetails = await decrypt_fiat_loan_details(
      inputInnerFiatLoanDetails,
      ownEncryptedEncryptionKey,
    );

    let iban_transfer_details = undefined;
    if (fiatLoanDetails.iban_transfer_details) {
      iban_transfer_details = {
        iban: fiatLoanDetails.iban_transfer_details.iban,
        bic: fiatLoanDetails.iban_transfer_details.bic,
      };
    }

    let swift_transfer_details = undefined;
    if (fiatLoanDetails.swift_transfer_details) {
      swift_transfer_details = {
        account_number: fiatLoanDetails.swift_transfer_details.account_number,
        swift_or_bic: fiatLoanDetails.swift_transfer_details.bic_or_swift,
      };
    }

    return {
      iban_transfer_details,
      swift_transfer_details,
      bank_name: fiatLoanDetails.bank_name,
      bank_address: fiatLoanDetails.bank_address,
      bank_country: fiatLoanDetails.bank_country,
      purpose_of_remittance: fiatLoanDetails.purpose_of_remittance,
      full_name: fiatLoanDetails.full_name,
      address: fiatLoanDetails.address,
      city: fiatLoanDetails.city,
      post_code: fiatLoanDetails.post_code,
      country: fiatLoanDetails.country,
      comments: fiatLoanDetails.comments,
    };
  };

  const value = {
    isInitialized,
    isWalletLoaded,
    doesWalletExist,
    loadWallet,
    getMnemonic,
    getNsec,
    getPubkeyFromContract,
    getNextPublicKey,
    signClaimPsbt,
    signLiquidationPsbt,
    getXpub,
    encryptFiatLoanDetailsBorrower,
    encryptFiatLoanDetailsLender,
    decryptFiatLoanDetails,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

export default WalletProvider;
