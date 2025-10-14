/**
 * Message types for communication between Lendasat iframe and parent wallet
 */

/**
 * Loan asset types supported by Lendasat
 * Imported from @repo/api to maintain consistency
 */
export type LoanAsset =
  | "UsdcPol"
  | "UsdtPol"
  | "UsdcEth"
  | "UsdtEth"
  | "UsdcStrk"
  | "UsdtStrk"
  | "UsdcSol"
  | "UsdtSol"
  | "Usd"
  | "Eur"
  | "Chf"
  | "Mxn"
  | "UsdtLiquid";

/**
 * Address types that can be requested from the wallet
 */
export enum AddressType {
  /** Bitcoin address (P2WPKH, P2PKH, etc.) */
  BITCOIN = "bitcoin",
  /** Ark address */
  ARK = "ark",
  /** Loan asset address (depends on the loan asset - e.g., Ethereum for USDC) */
  LOAN_ASSET = "loan_asset",
}

/**
 * Wallet capabilities - describes what features the wallet supports
 * This allows the iframe to adapt its UI based on wallet capabilities
 */
export interface WalletCapabilities {
  /** Bitcoin operations */
  bitcoin: {
    /** Can sign PSBTs for collateral withdrawal */
    signPsbt: boolean;
    /** Can send Bitcoin transactions */
    sendBitcoin: boolean;
  };
  /** Supported loan assets for receiving/sending payments */
  loanAssets: {
    /** List of loan assets the wallet can handle (e.g., ["UsdcPol", "UsdtEth"]) */
    supportedAssets: LoanAsset[];
    /** Can provide addresses for receiving loan payments */
    canReceive: boolean;
    /** Can send loan repayment transactions */
    canSend: boolean;
  };
  /** Nostr support */
  nostr: {
    /** Has a Nostr public key (npub) available */
    hasNpub: boolean;
  };
  /** Ark support */
  ark: {
    /** Can send on Ark */
    canSend: boolean;
    /** Can receive on Ark */
    canReceive: boolean;
  };
}

// Request messages sent from iframe to parent wallet
export type WalletRequest =
  | GetCapabilitiesRequest
  | GetPublicKeyRequest
  | GetDerivationPathRequest
  | GetAddressRequest
  | GetNpubRequest
  | SignPsbtRequest
  | SendToAddressRequest
  | SignMessageRequest;

export interface GetCapabilitiesRequest {
  type: "GET_CAPABILITIES";
  id: string;
}

export interface GetPublicKeyRequest {
  type: "GET_PUBLIC_KEY";
  id: string;
}

export interface GetDerivationPathRequest {
  type: "GET_DERIVATION_PATH";
  id: string;
}

export interface GetAddressRequest {
  type: "GET_ADDRESS";
  id: string;
  /** Type of address to retrieve */
  addressType: AddressType;
  /** Optional: Asset identifier for LOAN_ASSET type */
  asset?: LoanAsset;
}

export interface GetNpubRequest {
  type: "GET_NPUB";
  id: string;
}

export interface SignPsbtRequest {
  type: "SIGN_PSBT";
  id: string;
  /** Hex-encoded PSBT to sign */
  psbt: string;
  /** Collateral descriptor for the multisig script */
  collateralDescriptor: string;
  /** Borrower's public key */
  borrowerPk: string;
}

export interface SendToAddressRequest {
  type: "SEND_TO_ADDRESS";
  id: string;
  /** Address to send to */
  address: string;
  /** Amount to send in satoshis (for Bitcoin) or smallest unit for other assets */
  amount: number;
  /** Asset type - "bitcoin" for Bitcoin, or a LoanAsset type for other assets */
  asset: "bitcoin" | LoanAsset;
}

export interface SignMessageRequest {
  type: "SIGN_MESSAGE";
  id: string;
  /** Message to sign (will be hashed with SHA256 before signing) */
  message: string;
}

// Response messages sent from parent wallet to iframe
export type WalletResponse =
  | CapabilitiesResponse
  | PublicKeyResponse
  | DerivationPathResponse
  | AddressResponse
  | NpubResponse
  | PsbtSignedResponse
  | SendToAddressResponse
  | SignedMessageResponse
  | ErrorResponse;

export interface CapabilitiesResponse {
  type: "CAPABILITIES_RESPONSE";
  id: string;
  /** The wallet's capabilities */
  capabilities: WalletCapabilities;
}

export interface PublicKeyResponse {
  type: "PUBLIC_KEY_RESPONSE";
  id: string;
  /** Hex-encoded compressed public key (33 bytes = 66 hex chars) */
  publicKey: string;
}

export interface DerivationPathResponse {
  type: "DERIVATION_PATH_RESPONSE";
  id: string;
  /** BIP32 derivation path, e.g., "m/84'/0'/0'/0/0" */
  path: string;
}

export interface AddressResponse {
  type: "ADDRESS_RESPONSE";
  id: string;
  /** The requested address, or null if not supported */
  address: string | null;
  /** The type of address returned */
  addressType: AddressType;
}

export interface NpubResponse {
  type: "NPUB_RESPONSE";
  id: string;
  /** Nostr public key in npub format, or null if not supported */
  npub: string | null;
}

export interface PsbtSignedResponse {
  type: "PSBT_SIGNED";
  id: string;
  /** Base64-encoded signed PSBT */
  signedPsbt: string;
}

export interface SendToAddressResponse {
  type: "SEND_TO_ADDRESS_RESPONSE";
  id: string;
  /** Transaction ID (txid) of the broadcast transaction */
  txid: string;
}

export interface SignedMessageResponse {
  type: "SIGNED_MESSAGE";
  id: string;
  /** Hex-encoded ECDSA signature */
  signature: string;
}

export interface ErrorResponse {
  type: "ERROR";
  id: string;
  error: string;
}

// Type guards
export function isWalletRequest(message: unknown): message is WalletRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as { type?: string };
  return (
    msg.type === "GET_CAPABILITIES" ||
    msg.type === "GET_PUBLIC_KEY" ||
    msg.type === "GET_DERIVATION_PATH" ||
    msg.type === "GET_ADDRESS" ||
    msg.type === "GET_NPUB" ||
    msg.type === "SIGN_PSBT" ||
    msg.type === "SEND_TO_ADDRESS" ||
    msg.type === "SIGN_MESSAGE"
  );
}

export function isWalletResponse(message: unknown): message is WalletResponse {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as { type?: string };
  return (
    msg.type === "CAPABILITIES_RESPONSE" ||
    msg.type === "PUBLIC_KEY_RESPONSE" ||
    msg.type === "DERIVATION_PATH_RESPONSE" ||
    msg.type === "ADDRESS_RESPONSE" ||
    msg.type === "NPUB_RESPONSE" ||
    msg.type === "PSBT_SIGNED" ||
    msg.type === "SEND_TO_ADDRESS_RESPONSE" ||
    msg.type === "SIGNED_MESSAGE" ||
    msg.type === "ERROR"
  );
}
