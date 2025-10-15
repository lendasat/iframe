import { useState, useRef, useEffect } from "react";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { Buffer } from "buffer";
import {
  WalletProvider,
  AddressType,
  type LoanAsset,
  type WalletCapabilities,
} from "@lendasat/lendasat-wallet-bridge";
import "./App.css";
import * as tools from "uint8array-tools";
import {
  loadPrivateKey,
  savePrivateKey,
  loadCapabilities,
  saveCapabilities,
} from "./storage";

// Make Buffer available globally for bitcoinjs-lib
// @ts-expect-error "this is needed for ios devices"
window.Buffer = Buffer;

const ECPair = ECPairFactory(ecc);

function App() {
  const [privateKey, setPrivateKey] = useState(() => loadPrivateKey());
  const [address, setAddress] = useState<string>("");
  const [publicKey, setPublicKey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [keyPair, setKeyPair] = useState<ReturnType<
    typeof ECPair.fromPrivateKey
  > | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const providerRef = useRef<WalletProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [capabilities, setCapabilities] = useState<WalletCapabilities>(() =>
    loadCapabilities(),
  );

  const initializeWallet = (privateKeyHex: string) => {
    try {
      // Validate private key length
      if (privateKeyHex.length !== 64) {
        throw new Error("Private key must be 64 hex characters");
      }

      // Create key pair from private key
      const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, "hex"), {
        network: bitcoin.networks.bitcoin,
      });

      // Derive P2WPKH (native segwit) address
      const { address: btcAddress } = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: bitcoin.networks.bitcoin,
      });

      if (!btcAddress) {
        throw new Error("Failed to derive address");
      }

      setAddress(btcAddress);
      setPublicKey(tools.toHex(keyPair.publicKey));
      setKeyPair(keyPair);
      setError("");
      console.log("Address:", btcAddress);
      console.log("Public Key:", tools.toHex(keyPair.publicKey));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid private key");
      setAddress("");
      setPublicKey("");
      setKeyPair(null);
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initializeWallet(privateKey)) {
      // Save to storage only if initialization was successful
      savePrivateKey(privateKey);
    }
  };

  // Auto-initialize wallet on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeWallet(privateKey);
      setIsInitialized(true);
    }
  }, []);

  // Set up WalletProvider to handle iframe requests
  useEffect(() => {
    if (!keyPair || !iframeRef.current) {
      return;
    }

    // Clean up previous provider if it exists
    if (providerRef.current) {
      providerRef.current.destroy();
    }

    // Create new provider with handlers
    const provider = new WalletProvider(
      {
        // Declare wallet capabilities as a function
        capabilities: () => {
          console.log("[Sample Wallet] Capabilities function called");
          return capabilities;
        },
        onGetPublicKey: () => {
          console.log(`Called on get pk`);
          if (!keyPair) throw new Error("No key pair loaded");
          return tools.toHex(keyPair.publicKey);
        },
        onGetDerivationPath: () => {
          console.log(`Called on get derivation path`);
          // For now, hardcode the derivation path
          // In a real wallet, this would come from the wallet's state
          return "m/84'/0'/0'/0/0";
        },
        onGetAddress: async (addressType: AddressType, asset?: LoanAsset) => {
          console.log(
            `Called on get address: type=${addressType}, asset=${asset}`,
          );

          switch (addressType) {
            case AddressType.BITCOIN:
              if (!address) return null;
              return address;

            case AddressType.ARK:
              // TODO: Implement Ark address generation/retrieval
              return null;

            case AddressType.LOAN_ASSET:
              if (!asset) return null;

              // Map loan assets to blockchain addresses
              // This would be derived from the wallet in a real implementation
              switch (asset) {
                case "UsdcPol":
                case "UsdtPol":
                  // Polygon address
                  return "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
                case "UsdcEth":
                case "UsdtEth":
                case "UsdcStrk":
                case "UsdtStrk":
                case "UsdcSol":
                case "UsdtSol":
                case "UsdtLiquid":
                case "Usd":
                case "Eur":
                case "Chf":
                case "Mxn":
                  // Fiat - no blockchain address needed
                  return null;
                default:
                  // Unknown asset type
                  return null;
              }

            default:
              // Unknown address type
              throw new Error(`Unknown address type: ${addressType}`);
          }
        },
        onGetNpub: async () => {
          console.log(`Called on get npub`);
          // TODO: Implement Nostr npub conversion
          return null;
        },
        onSignPsbt: async (
          psbt: string,
          collateralDescriptor: string,
          borrowerPk: string,
        ) => {
          console.log(
            `Called sign psbt with descriptor: ${collateralDescriptor}`,
          );
          console.log(`Borrower PK: ${borrowerPk}`);
          console.log(`PSBT: ${psbt}`);

          if (!keyPair) {
            throw new Error("No key pair loaded");
          }

          try {
            // Parse the hex-encoded PSBT
            const psbtObj = bitcoin.Psbt.fromHex(psbt, {
              network: bitcoin.networks.bitcoin,
            });

            console.log(`PSBT has ${psbtObj.data.inputs.length} inputs`);

            // Verify the borrower's public key matches our wallet
            const ourPk = tools.toHex(keyPair.publicKey);
            if (borrowerPk !== ourPk) {
              console.warn(
                `Warning: Borrower PK (${borrowerPk}) doesn't match wallet PK (${ourPk})`,
              );
            }

            // Sign all inputs that this wallet can sign
            // The PSBT should already have the necessary witness UTXOs and scripts
            psbtObj.signAllInputs(keyPair);

            console.log(`Signed all inputs`);

            const signedPsbt = psbtObj.toHex();

            console.log(`PSBT signed successfully. Psbt hex: ${signedPsbt}`);

            return signedPsbt;
          } catch (err) {
            console.error("Failed to sign PSBT:", err);
            throw new Error(
              `Failed to sign PSBT: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        },
        onSendToAddress: async (
          address: string,
          amount: number,
          asset: "bitcoin" | LoanAsset,
        ) => {
          console.log(
            `Called send to address: address=${address}, amount=${amount}, asset=${asset}`,
          );

          if (asset !== "bitcoin") {
            throw new Error(`Sending ${asset} is not yet implemented`);
          }

          if (!keyPair) {
            throw new Error("No key pair loaded");
          }

          // TODO: Implement actual Bitcoin transaction creation and broadcasting
          // This is a placeholder that simulates the transaction
          throw new Error(
            "Bitcoin transaction sending not yet implemented. In a real wallet, this would create and broadcast a transaction.",
          );
        },
        onSignMessage: async (message: string) => {
          console.log(`Called sign message: ${message}`);

          if (!keyPair) {
            throw new Error("No key pair loaded");
          }

          try {
            // Hash the message with SHA256 using Web Crypto API
            const encoder = new TextEncoder();
            const messageBytes = encoder.encode(message);
            const hashBuffer = await crypto.subtle.digest(
              "SHA-256",
              messageBytes,
            );
            const messageHash = Buffer.from(hashBuffer);

            // Sign the hash with the private key using ECDSA (produces raw 64-byte signature)
            const rawSignature = keyPair.sign(messageHash);

            // Convert to DER format using bitcoinjs-lib's built-in function
            // This handles all edge cases including R/S padding for negative values
            // The 0x01 is a dummy sighash type that we'll remove after
            const derSignature = bitcoin.script.signature.encode(
              rawSignature,
              0x01,
            );

            // Remove the sighash byte (last byte) since we only want the DER signature
            const derSignatureOnly = derSignature.slice(0, -1);

            // Return the DER-encoded signature as hex string
            const signatureHex = tools.toHex(derSignatureOnly);

            console.log(
              `Message signed successfully. DER signature: ${signatureHex}`,
            );

            return signatureHex;
          } catch (err) {
            console.error("Failed to sign message:", err);
            throw new Error(
              `Failed to sign message: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        },
      },
      [import.meta.env.VITE_IFRAME_URL],
    ); // Allow iframe origin

    provider.listen(iframeRef.current);
    providerRef.current = provider;

    console.log("WalletProvider initialized and listening to iframe");

    // Cleanup on unmount
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [keyPair, address, capabilities]);

  const handleCapabilityChange = (
    category: keyof WalletCapabilities,
    key: string,
    value: boolean,
  ) => {
    setCapabilities((prev) => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };
      saveCapabilities(updated);
      return updated;
    });
  };

  const handleLoanAssetToggle = (asset: LoanAsset) => {
    setCapabilities((prev) => {
      const supportedAssets = prev.loanAssets.supportedAssets.includes(asset)
        ? prev.loanAssets.supportedAssets.filter((a) => a !== asset)
        : [...prev.loanAssets.supportedAssets, asset];

      const updated = {
        ...prev,
        loanAssets: {
          ...prev.loanAssets,
          supportedAssets,
        },
      };
      saveCapabilities(updated);
      return updated;
    });
  };

  return (
    <div className="app">
      <h1>Hello Wallet</h1>
      <div className="content">
        <div className="sidebar">
          <form onSubmit={handleSubmit} className="private-key-form">
            <input
              type="text"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Enter private key (hex)"
              className="private-key-input"
            />
            <button type="submit" className="submit-button">
              Load Wallet
            </button>
            {error && <div className="error-message">{error}</div>}
            {address && (
              <div className="wallet-info">
                <div className="info-item">
                  <label>Address:</label>
                  <div className="info-value">{address}</div>
                </div>
                <div className="info-item">
                  <label>Public Key:</label>
                  <div className="info-value">{publicKey}</div>
                </div>
              </div>
            )}
          </form>

          {/* Capabilities Configuration */}
          <div className="capabilities-config">
            <h2>Wallet Capabilities</h2>

            <div className="capability-section">
              <h3>Bitcoin</h3>
              <label className="capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilities.bitcoin.sendBitcoin}
                  onChange={(e) =>
                    handleCapabilityChange(
                      "bitcoin",
                      "sendBitcoin",
                      e.target.checked,
                    )
                  }
                />
                <span>Can send Bitcoin</span>
              </label>
            </div>

            <div className="capability-section">
              <h3>Loan Assets</h3>
              <label className="capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilities.loanAssets.canReceive}
                  onChange={(e) =>
                    handleCapabilityChange(
                      "loanAssets",
                      "canReceive",
                      e.target.checked,
                    )
                  }
                />
                <span>Can receive loan assets</span>
              </label>
              <label className="capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilities.loanAssets.canSend}
                  onChange={(e) =>
                    handleCapabilityChange(
                      "loanAssets",
                      "canSend",
                      e.target.checked,
                    )
                  }
                />
                <span>Can send loan assets</span>
              </label>

              <div className="supported-assets">
                <h4>Supported Assets</h4>
                <div className="asset-grid">
                  {(
                    [
                      "UsdcPol",
                      "UsdtPol",
                      "UsdcEth",
                      "UsdtEth",
                      "UsdcStrk",
                      "UsdtStrk",
                      "UsdcSol",
                      "UsdtSol",
                      "UsdtLiquid",
                      "Usd",
                      "Eur",
                      "Chf",
                      "Mxn",
                    ] as LoanAsset[]
                  ).map((asset) => (
                    <label key={asset} className="asset-checkbox">
                      <input
                        type="checkbox"
                        checked={capabilities.loanAssets.supportedAssets.includes(
                          asset,
                        )}
                        onChange={() => handleLoanAssetToggle(asset)}
                      />
                      <span>{asset}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="capability-section">
              <h3>Nostr</h3>
              <label className="capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilities.nostr.hasNpub}
                  onChange={(e) =>
                    handleCapabilityChange("nostr", "hasNpub", e.target.checked)
                  }
                />
                <span>Has Nostr public key (npub)</span>
              </label>
            </div>

            <div className="capability-section">
              <h3>Ark</h3>
              <label className="capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilities.ark.canSend}
                  onChange={(e) =>
                    handleCapabilityChange("ark", "canSend", e.target.checked)
                  }
                />
                <span>Can send on Ark</span>
              </label>
              <label className="capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilities.ark.canReceive}
                  onChange={(e) =>
                    handleCapabilityChange(
                      "ark",
                      "canReceive",
                      e.target.checked,
                    )
                  }
                />
                <span>Can receive on Ark</span>
              </label>
            </div>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          src={import.meta.env.VITE_IFRAME_URL}
          title="Lendasat"
          className="lendasat-iframe"
          allow="clipboard-write; clipboard-read"
        />
      </div>
    </div>
  );
}

export default App;
