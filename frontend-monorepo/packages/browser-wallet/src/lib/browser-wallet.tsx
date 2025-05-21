import init, {
  get_next_address,
  derive_nostr_room_pk,
  does_wallet_exist,
  encrypt_fiat_loan_details,
  get_mnemonic,
  get_nsec,
  InnerFiatLoanDetails,
  is_wallet_loaded,
  load_wallet,
  sign_claim_psbt,
  sign_liquidation_psbt,
  unlock_and_sign_claim_psbt,
  SwiftTransferDetails,
  IbanTransferDetails,
  SignedTransaction,
  get_npub,
  get_pk_and_derivation_path,
  get_version,
  sign_liquidation_psbt_with_password,
  FiatLoanDetails,
  decrypt_fiat_loan_details_with_password,
  sign_message_with_pk,
  sign_message_with_pk_and_password,
} from "browser-wallet";
import browserWalletUrl from "../../../../../browser-wallet/pkg/browser_wallet_bg.wasm?url";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  FiatLoanDetails as ReactFiatLoanDetails,
  InnerFiatLoanDetails as ReactInnerFiatLoanDetails,
} from "@frontend/base-http-client";
import { md5CaseInsensitive } from "../index";

export interface PkAndPath {
  pubkey: string;
  path: string;
}

export interface Version {
  version: string;
  commit_hash: string;
  build_timestamp: bigint;
}

export interface SignedMessage {
  message: String;
  recoverableSignatureHex: String;
  recoverableSignatureId: number;
}

interface WalletContextType {
  isInitialized: boolean;
  isWalletLoaded: boolean;
  doesWalletExist?: boolean;
  loadWallet: (passphrase: string) => Promise<void>;
  getMnemonic: () => string;
  getNsec: () => Promise<string>;
  getPubkeyFromContract: (passphrase: string) => string;
  signClaimPsbt: (
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
    derivationPath?: string,
  ) => Promise<SignedTransaction>;
  unlockAndSignClaimPsbt: (
    password: string,
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
    derivationPath?: string,
  ) => Promise<SignedTransaction>;
  signLiquidationPsbt: (
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
    derivationPath?: string,
  ) => Promise<SignedTransaction>;
  signLiquidationPsbtWithPassword: (
    password: string,
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
    derivationPath?: string,
  ) => Promise<SignedTransaction>;
  getNpub: () => Promise<string>;
  getPkAndDerivationPath: () => Promise<PkAndPath>;
  getNextAddress: () => Promise<string>;
  encryptFiatLoanDetailsBorrower: (
    details: ReactInnerFiatLoanDetails,
    ownPk: string,
    counterpartyPk: string,
  ) => Promise<ReactFiatLoanDetails>;
  encryptFiatLoanDetailsLender: (
    details: ReactInnerFiatLoanDetails,
    ownPk: string,
    counterpartyPk: string,
  ) => Promise<ReactFiatLoanDetails>;
  decryptFiatLoanDetailsWithPassword: (
    password: string,
    details: ReactInnerFiatLoanDetails,
    ownEncryptedEncryptionKey: string,
    ownDerivationPath: string,
  ) => Promise<ReactInnerFiatLoanDetails>;
  getVersion: () => Version;
  signMessage: (
    message: string,
    own_pk: string,
    derivation_path?: string,
  ) => Promise<SignedMessage>;
  signMessageWithPassword: (
    password: string,
    message: string,
    own_pk: string,
    derivation_path?: string,
  ) => Promise<SignedMessage>;
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

  function initialize() {
    init(browserWalletUrl)
      .then(async () => {
        setIsInitialized(true);
        const key = await md5CaseInsensitive(email);

        setDoesWalletExist(does_wallet_exist(key));
        setIsWalletLoaded(is_wallet_loaded());
      })
      .catch((error) => {
        console.log(`Failed initializing wasm library ${error}`);
      });
  }

  useEffect(
    () => {
      initialize();
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: probably necessary
    [initialize],
  );

  const loadWallet = async (passphrase: string) => {
    console.log("loading wallet");
    if (isInitialized) {
      const key = await md5CaseInsensitive(email);
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

  const getNsec = async () => {
    if (isInitialized) {
      const key = await md5CaseInsensitive(email);
      return get_nsec(key);
    }
    throw Error("Wallet not initialized");
  };

  const getPubkeyFromContract = (contract: string) => {
    return derive_nostr_room_pk(contract);
  };

  const signClaimPsbt = async (
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
    derivationPath?: string,
  ) => {
    if (isInitialized && isWalletLoaded) {
      return sign_claim_psbt(
        psbt,
        collateralDescriptor,
        borrowerPk,
        derivationPath,
      );
    } else {
      throw Error("Wallet not initialized");
    }
  };

  /**
   * Unlocks the wallet and signs the PSBT in one call
   *
   * This is used in context where we are not sure if the wallet is unlocked, i.e. always :D
   */
  const unlockAndSignClaimPsbt = async (
    password: string,
    psbt: string,
    collateralDescriptor: string,
    borrowerPk: string,
    derivationPath?: string,
  ) => {
    if (isInitialized) {
      if (isWalletLoaded) {
        return sign_claim_psbt(
          psbt,
          collateralDescriptor,
          borrowerPk,
          derivationPath,
        );
      }

      const key = await md5CaseInsensitive(email);
      const signedPsbt = unlock_and_sign_claim_psbt(
        password,
        key,
        psbt,
        collateralDescriptor,
        borrowerPk,
        derivationPath,
      );
      setIsWalletLoaded(true);
      return signedPsbt;
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const signLiquidationPsbt = async (
    psbt: string,
    collateralDescriptor: string,
    lenderPk: string,
    derivationPath?: string,
  ) => {
    if (isInitialized && isWalletLoaded) {
      return sign_liquidation_psbt(
        psbt,
        collateralDescriptor,
        lenderPk,
        derivationPath,
      );
    } else {
      throw Error("Wallet not initialized");
    }
  };

  const signLiquidationPsbtWithPassword = async (
    password: string,
    psbt: string,
    collateralDescriptor: string,
    lenderPk: string,
    derivationPath?: string,
  ) => {
    const key = await md5CaseInsensitive(email);
    return sign_liquidation_psbt_with_password(
      password,
      key,
      psbt,
      collateralDescriptor,
      lenderPk,
      derivationPath,
    );
  };

  const getNpub = async () => {
    const key = await md5CaseInsensitive(email);
    return get_npub(key);
  };

  const getPkAndDerivationPath = async () => {
    const key = await md5CaseInsensitive(email);
    const res = get_pk_and_derivation_path(key);
    return {
      pubkey: res.pubkey,
      path: res.path,
    };
  };

  const getNextAddress = async () => {
    const key = await md5CaseInsensitive(email);
    return get_next_address(key);
  };

  const encryptFiatLoanDetailsBorrower = async (
    details: ReactInnerFiatLoanDetails,
    ownPk: string,
    counterpartyPk: string,
  ) => {
    return encryptFiatLoanDetails(details, ownPk, counterpartyPk, true);
  };

  const encryptFiatLoanDetailsLender = async (
    details: ReactInnerFiatLoanDetails,
    ownPk: string,
    counterpartyPk: string,
  ) => {
    return encryptFiatLoanDetails(details, ownPk, counterpartyPk, false);
  };

  const encryptFiatLoanDetails = async (
    details: ReactInnerFiatLoanDetails,
    ownPk: string,
    counterpartyPk: string,
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

    let fiatLoanDetails: FiatLoanDetails;

    fiatLoanDetails = encrypt_fiat_loan_details(
      inputInnerFiatLoanDetails,
      ownPk,
      counterpartyPk,
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

  const decryptFiatLoanDetailsWithPassword = async (
    password: string,
    details: ReactInnerFiatLoanDetails,
    ownEncryptedEncryptionKey: string,
    ownDerivationPath: string,
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

    const key = await md5CaseInsensitive(email);

    const fiatLoanDetails = decrypt_fiat_loan_details_with_password(
      password,
      key,
      inputInnerFiatLoanDetails,
      ownEncryptedEncryptionKey,
      ownDerivationPath,
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

  const getVersion = () => {
    if (isInitialized) {
      const version = get_version();
      return {
        version: version.version,
        commit_hash: version.commit_hash,
        build_timestamp: version.build_timestamp,
      };
    } else {
      throw Error("Wasm not initialized");
    }
  };

  const signMessage = async (
    message: string,
    own_pk: string,
    derivation_path?: string,
  ) => {
    if (isWalletLoaded) {
      const signedMessage = sign_message_with_pk(
        message,
        own_pk,
        derivation_path,
      );
      return {
        message: signedMessage.message,
        recoverableSignatureHex: signedMessage.recoverable_signature_hex,
        recoverableSignatureId: signedMessage.recoverable_signature_id,
      };
    } else {
      throw Error("Wallet not loaded");
    }
  };

  const signMessageWithPassword = async (
    password: string,
    message: string,
    own_pk: string,
    derivation_path?: string,
  ) => {
    const key = await md5CaseInsensitive(email);
    const signedMessage = sign_message_with_pk_and_password(
      password,
      key,
      message,
      own_pk,
      derivation_path,
    );

    // afterwards the wallet is loaded.
    setIsWalletLoaded(true);

    return {
      message: signedMessage.message,
      recoverableSignatureHex: signedMessage.recoverable_signature_hex,
      recoverableSignatureId: signedMessage.recoverable_signature_id,
    };
  };

  const value = {
    isInitialized,
    isWalletLoaded,
    doesWalletExist,
    loadWallet,
    getMnemonic,
    getNsec,
    getNpub,
    getPkAndDerivationPath,
    getNextAddress,
    getPubkeyFromContract,
    signClaimPsbt,
    signLiquidationPsbt,
    signLiquidationPsbtWithPassword,
    encryptFiatLoanDetailsBorrower,
    encryptFiatLoanDetailsLender,
    decryptFiatLoanDetailsWithPassword,
    unlockAndSignClaimPsbt,
    getVersion,
    signMessage,
    signMessageWithPassword,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

export default WalletProvider;
