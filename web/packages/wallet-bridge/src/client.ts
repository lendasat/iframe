import type { WalletRequest, WalletResponse, ErrorResponse, LoanAsset } from "./types";
import { isWalletResponse, AddressType } from "./types";

/**
 * Client for Lendasat iframe to communicate with parent wallet
 *
 * Usage:
 * ```typescript
 * const client = new LendasatClient();
 * const publicKey = await client.getPublicKey();
 * const path = await client.getDerivationPath();
 * const npub = await client.getNpub();
 * const signed = await client.signPsbt(psbtBase64);
 * ```
 */
export class LendasatClient {
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >;
  private targetOrigin: string;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  /**
   * @param targetOrigin - The origin of the parent wallet (default: "*" for development, should be specific in production)
   * @param timeout - Request timeout in milliseconds (default: 30000)
   */
  constructor(
    private readonly timeout: number = 30000,
    targetOrigin: string = "*",
  ) {
    this.pendingRequests = new Map();
    this.targetOrigin = targetOrigin;
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    this.messageHandler = (event: MessageEvent) => {
      // TODO: In production, validate event.origin matches expected parent origin
      const message = event.data;

      if (!isWalletResponse(message)) {
        return;
      }

      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }

      this.pendingRequests.delete(message.id);

      if (message.type === "ERROR") {
        pending.reject(new Error((message as ErrorResponse).error));
      } else {
        pending.resolve(message);
      }
    };

    window.addEventListener("message", this.messageHandler);
  }

  private sendRequest<T extends WalletResponse>(
    request: WalletRequest,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(
          new Error(
            `Request ${request.type} timed out after ${this.timeout}ms`,
          ),
        );
      }, this.timeout);

      this.pendingRequests.set(request.id, {
        resolve: (value) => {
          clearTimeout(timeoutId);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });

      if (!window.parent) {
        reject(new Error("Not running in an iframe"));
        return;
      }

      window.parent.postMessage(request, this.targetOrigin);
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the borrower's public key from the parent wallet
   * @returns Hex-encoded compressed public key (33 bytes = 66 hex chars)
   */
  async getPublicKey(): Promise<string> {
    const response = await this.sendRequest<{
      type: "PUBLIC_KEY_RESPONSE";
      id: string;
      publicKey: string;
    }>({
      type: "GET_PUBLIC_KEY",
      id: this.generateId(),
    });
    return response.publicKey;
  }

  /**
   * Get the BIP32 derivation path from the parent wallet
   * @returns BIP32 derivation path, e.g., "m/84'/0'/0'/0/0"
   */
  async getDerivationPath(): Promise<string> {
    const response = await this.sendRequest<{
      type: "DERIVATION_PATH_RESPONSE";
      id: string;
      path: string;
    }>({
      type: "GET_DERIVATION_PATH",
      id: this.generateId(),
    });
    return response.path;
  }

  /**
   * Get an address from the parent wallet
   * @param addressType - The type of address to retrieve (bitcoin, ark, or loan_asset)
   * @param asset - Optional asset identifier for LOAN_ASSET type (e.g., "UsdcPol", "UsdtEth")
   * @returns The requested address
   */
  async getAddress(addressType: AddressType = AddressType.BITCOIN, asset?: LoanAsset): Promise<string> {
    const response = await this.sendRequest<{
      type: "ADDRESS_RESPONSE";
      id: string;
      address: string;
      addressType: AddressType;
    }>({
      type: "GET_ADDRESS",
      id: this.generateId(),
      addressType,
      asset,
    });
    return response.address;
  }

  /**
   * Get the borrower's Nostr public key (npub) from the parent wallet
   * @returns Nostr public key in npub format
   */
  async getNpub(): Promise<string> {
    const response = await this.sendRequest<{
      type: "NPUB_RESPONSE";
      id: string;
      npub: string;
    }>({
      type: "GET_NPUB",
      id: this.generateId(),
    });
    return response.npub;
  }

  /**
   * Request the parent wallet to sign a PSBT
   * @param psbt - Base64-encoded PSBT to sign
   * @returns Base64-encoded signed PSBT
   */
  async signPsbt(psbt: string): Promise<string> {
    const response = await this.sendRequest<{
      type: "PSBT_SIGNED";
      id: string;
      signedPsbt: string;
    }>({
      type: "SIGN_PSBT",
      id: this.generateId(),
      psbt,
    });
    return response.signedPsbt;
  }

  /**
   * Get the Lendasat API key from the parent wallet
   * @returns Lendasat API key
   */
  async getApiKey(): Promise<string> {
    const response = await this.sendRequest<{
      type: "API_KEY_RESPONSE";
      id: string;
      apiKey: string;
    }>({
      type: "GET_API_KEY",
      id: this.generateId(),
    });
    return response.apiKey;
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
    this.pendingRequests.clear();
  }
}
