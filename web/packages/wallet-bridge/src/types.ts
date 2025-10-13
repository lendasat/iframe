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

// Request messages sent from iframe to parent wallet
export type WalletRequest =
  | GetPublicKeyRequest
  | GetDerivationPathRequest
  | GetAddressRequest
  | GetNpubRequest
  | SignPsbtRequest;

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
  /** Base64-encoded PSBT to sign */
  psbt: string;
}

export interface GetApiKeyRequest {
  type: "GET_API_KEY";
  id: string;
}

// Response messages sent from parent wallet to iframe
export type WalletResponse =
  | PublicKeyResponse
  | DerivationPathResponse
  | AddressResponse
  | NpubResponse
  | PsbtSignedResponse
  | ApiKeyResponse
  | ErrorResponse;

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
  /** The requested address */
  address: string;
  /** The type of address returned */
  addressType: AddressType;
}

export interface NpubResponse {
  type: "NPUB_RESPONSE";
  id: string;
  /** Nostr public key in npub format */
  npub: string;
}

export interface PsbtSignedResponse {
  type: "PSBT_SIGNED";
  id: string;
  /** Base64-encoded signed PSBT */
  signedPsbt: string;
}

export interface ApiKeyResponse {
  type: "API_KEY_RESPONSE";
  id: string;
  /** Lendasat API key */
  apiKey: string;
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
    msg.type === "GET_PUBLIC_KEY" ||
    msg.type === "GET_DERIVATION_PATH" ||
    msg.type === "GET_ADDRESS" ||
    msg.type === "GET_NPUB" ||
    msg.type === "SIGN_PSBT" ||
    msg.type === "GET_API_KEY"
  );
}

export function isWalletResponse(message: unknown): message is WalletResponse {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as { type?: string };
  return (
    msg.type === "PUBLIC_KEY_RESPONSE" ||
    msg.type === "DERIVATION_PATH_RESPONSE" ||
    msg.type === "ADDRESS_RESPONSE" ||
    msg.type === "NPUB_RESPONSE" ||
    msg.type === "PSBT_SIGNED" ||
    msg.type === "API_KEY_RESPONSE" ||
    msg.type === "ERROR"
  );
}
