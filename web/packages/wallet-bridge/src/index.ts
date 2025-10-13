/**
 * @lendasat/wallet-bridge
 *
 * Library for communication between Lendasat iframe and parent wallet applications
 *
 * ## For iframe (Lendasat app):
 * ```typescript
 * import { LendasatClient } from '@lendasat/wallet-bridge';
 *
 * const client = new LendasatClient();
 * const publicKey = await client.getPublicKey();
 * const path = await client.getDerivationPath();
 * const npub = await client.getNpub();
 * const signed = await client.signPsbt(psbtBase64);
 * ```
 *
 * ## For parent wallet:
 * ```typescript
 * import { WalletProvider } from '@lendasat/wallet-bridge';
 *
 * const provider = new WalletProvider({
 *   onGetPublicKey: () => keyPair.publicKey.toString('hex'),
 *   onGetDerivationPath: () => "m/84'/0'/0'/0/0",
 *   onGetNpub: () => convertToNpub(keyPair.publicKey),
 *   onSignPsbt: (psbt) => signPsbtWithKey(psbt, keyPair),
 * });
 *
 * provider.listen(iframeRef.current);
 * ```
 */

export { LendasatClient } from "./client";
export { WalletProvider, type WalletHandlers } from "./provider";
export type {
  WalletRequest,
  WalletResponse,
  WalletCapabilities,
  GetCapabilitiesRequest,
  CapabilitiesResponse,
  GetPublicKeyRequest,
  GetDerivationPathRequest,
  GetAddressRequest,
  GetNpubRequest,
  SignPsbtRequest,
  PublicKeyResponse,
  DerivationPathResponse,
  AddressResponse,
  NpubResponse,
  PsbtSignedResponse,
  ErrorResponse,
} from "./types";
export { isWalletRequest, isWalletResponse, AddressType } from "./types";
export type { LoanAsset } from "./types";
