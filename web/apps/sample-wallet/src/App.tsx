import { useState, useRef, useEffect } from "react";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { Buffer } from "buffer";
import {
  WalletProvider,
  AddressType,
  type LoanAsset,
} from "@lendasat/lendasat-wallet-bridge";
import "./App.css";
import * as tools from "uint8array-tools";
import { loadPrivateKey, savePrivateKey } from "./storage";

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
        // Declare wallet capabilities
        capabilities: {
          bitcoin: {
            signPsbt: true,
            sendBitcoin: false, // Not yet implemented
          },
          loanAssets: {
            supportedAssets: [],
            canReceive: false, // Not implemented
            canSend: false, // Not yet implemented
          },
          nostr: {
            hasNpub: false, // Not implemented
          },
          ark: {
            canSend: false,
            canReceive: false,
          },
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
        onGetApiKey: () => {
          console.log(`Called on get API key`);
          // TODO: In a real wallet, this would be retrieved from secure storage
          return "lndst_sk_dee619e34a7e_NI2TUiMmYF9TcBavaFhUW0rZ63QOIsoldG1w0YdFMpR";
        },
        onGetAddress: (addressType: AddressType, asset?: LoanAsset) => {
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
                  // Ethereum address
                  return "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
                case "UsdcStrk":
                case "UsdtStrk":
                  // Starknet address
                  return "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
                case "UsdcSol":
                case "UsdtSol":
                  // Solana address
                  return "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
                case "UsdtLiquid":
                  // Liquid address
                  return "VJLCfH2dcqfvJG7HfUdcz4K4YY7vYYx6WBsKn";
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
        onGetNpub: () => {
          console.log(`Called on get npub`);
          // TODO: Implement Nostr npub conversion
          return null;
        },
        onSignPsbt: (
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

            // Finalize all inputs (convert signatures to final scriptWitness/scriptSig)
            psbtObj.finalizeAllInputs();

            console.log(`Finalized all inputs`);

            // Extract the fully signed transaction as hex
            const signedTx = psbtObj.extractTransaction().toHex();

            console.log(
              `PSBT signed successfully. Transaction hex: ${signedTx.substring(0, 50)}...`,
            );

            return signedTx;
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
      },
      ["http://localhost:5173"],
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
  }, [keyPair, address]);

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
        </div>
        <iframe
          ref={iframeRef}
          src="http://localhost:5173"
          title="Lendasat"
          className="lendasat-iframe"
          allow="clipboard-write; clipboard-read"
        />
      </div>
    </div>
  );
}

export default App;
