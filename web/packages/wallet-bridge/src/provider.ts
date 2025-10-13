import type { WalletRequest, WalletResponse, LoanAsset } from "./types";
import { isWalletRequest, AddressType } from "./types";

/**
 * Handler functions that the parent wallet must implement
 */
export interface WalletHandlers {
  /**
   * Return the borrower's public key in hex format (compressed, 33 bytes = 66 hex chars)
   */
  onGetPublicKey: () => string | Promise<string>;

  /**
   * Return the BIP32 derivation path, e.g., "m/84'/0'/0'/0/0"
   */
  onGetDerivationPath: () => string | Promise<string>;

  /**
   * Return an address based on the requested type
   * @param addressType - The type of address to retrieve (bitcoin, ark, or loan_asset)
   * @param asset - Optional asset identifier for LOAN_ASSET type (e.g., "UsdcPol", "UsdtEth")
   * @returns The requested address
   */
  onGetAddress: (addressType: AddressType, asset?: LoanAsset) => string | Promise<string>;

  /**
   * Return the borrower's Nostr public key in npub format
   */
  onGetNpub: () => string | Promise<string>;

  /**
   * Sign a PSBT and return the signed PSBT
   * @param psbt - Base64-encoded PSBT to sign
   * @returns Base64-encoded signed PSBT
   */
  onSignPsbt: (psbt: string) => string | Promise<string>;

  /**
   * Return the Lendasat API key
   * @returns Lendasat API key
   */
  onGetApiKey: () => string | Promise<string>;
}

/**
 * Provider for parent wallet to handle requests from Lendasat iframe
 *
 * Usage:
 * ```typescript
 * const provider = new WalletProvider({
 *   onGetPublicKey: () => keyPair.publicKey.toString('hex'),
 *   onGetDerivationPath: () => "m/84'/0'/0'/0/0",
 *   onGetNpub: () => convertToNpub(keyPair.publicKey),
 *   onSignPsbt: (psbt) => signPsbtWithKey(psbt, keyPair),
 * });
 *
 * // Start listening to messages from the iframe
 * provider.listen(iframeElement);
 * ```
 */
export class WalletProvider {
  private handlers: WalletHandlers;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private allowedOrigins: string[];

  /**
   * @param handlers - Handler functions for wallet operations
   * @param allowedOrigins - List of allowed iframe origins (default: ["*"] for development, should be specific in production)
   */
  constructor(handlers: WalletHandlers, allowedOrigins: string[] = ["*"]) {
    this.handlers = handlers;
    this.allowedOrigins = allowedOrigins;
  }

  /**
   * Start listening to messages from the iframe
   * @param iframe - The iframe element to listen to (optional, if not provided will listen to all messages)
   */
  listen(iframe?: HTMLIFrameElement): void {
    if (this.messageHandler) {
      // Already listening
      return;
    }

    this.messageHandler = async (event: MessageEvent) => {
      // Validate origin
      if (
        !this.allowedOrigins.includes("*") &&
        !this.allowedOrigins.includes(event.origin)
      ) {
        console.warn(
          `[WalletBridge Provider] Ignored message from unauthorized origin: ${event.origin}`,
        );
        return;
      }

      // Validate it's from the iframe we're listening to
      if (iframe && event.source !== iframe.contentWindow) {
        return;
      }

      const message = event.data;

      if (!isWalletRequest(message)) {
        return;
      }

      console.log("[WalletBridge Provider] Received request:", message.type, message);
      await this.handleRequest(message, event.source as Window);
    };

    window.addEventListener("message", this.messageHandler);
  }

  private async handleRequest(
    request: WalletRequest,
    source: Window,
  ): Promise<void> {
    try {
      let response: WalletResponse;

      switch (request.type) {
        case "GET_PUBLIC_KEY": {
          const publicKey = await this.handlers.onGetPublicKey();
          response = {
            type: "PUBLIC_KEY_RESPONSE",
            id: request.id,
            publicKey,
          };
          break;
        }

        case "GET_DERIVATION_PATH": {
          const path = await this.handlers.onGetDerivationPath();
          response = {
            type: "DERIVATION_PATH_RESPONSE",
            id: request.id,
            path,
          };
          break;
        }

        case "GET_ADDRESS": {
          const address = await this.handlers.onGetAddress(
            request.addressType,
            request.asset,
          );
          response = {
            type: "ADDRESS_RESPONSE",
            id: request.id,
            address,
            addressType: request.addressType,
          };
          break;
        }

        case "GET_NPUB": {
          const npub = await this.handlers.onGetNpub();
          response = {
            type: "NPUB_RESPONSE",
            id: request.id,
            npub,
          };
          break;
        }

        case "SIGN_PSBT": {
          const signedPsbt = await this.handlers.onSignPsbt(request.psbt);
          response = {
            type: "PSBT_SIGNED",
            id: request.id,
            signedPsbt,
          };
          break;
        }

        case "GET_API_KEY": {
          const apiKey = await this.handlers.onGetApiKey();
          response = {
            type: "API_KEY_RESPONSE",
            id: request.id,
            apiKey,
          };
          break;
        }

        default: {
          const exhaustiveCheck: never = request;
          throw new Error(`Unhandled request type: ${exhaustiveCheck}`);
        }
      }

      console.log("[WalletBridge Provider] Sending response:", response.type, response);
      source.postMessage(response, "*");
    } catch (error) {
      const errorResponse: WalletResponse = {
        type: "ERROR",
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      };
      console.error("[WalletBridge Provider] Error handling request:", error);
      console.log("[WalletBridge Provider] Sending error response:", errorResponse);
      source.postMessage(errorResponse, "*");
    }
  }

  /**
   * Stop listening to messages and clean up
   */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
  }
}
