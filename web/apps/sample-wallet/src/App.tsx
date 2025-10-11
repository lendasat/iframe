import { useState, useRef, useEffect } from "react";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { Buffer } from "buffer";
import { WalletProvider } from "@lendasat/wallet-bridge";
import "./App.css";

// Make Buffer available globally for bitcoinjs-lib
// @ts-expect-error "this is needed for ios devices"
window.Buffer = Buffer;

const ECPair = ECPairFactory(ecc);

function App() {
  const [privateKey, setPrivateKey] = useState(
    "0000000000000000000000000000000000000000000000000000000000000001",
  );
  const [address, setAddress] = useState<string>("");
  const [publicKey, setPublicKey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [keyPair, setKeyPair] = useState<ReturnType<
    typeof ECPair.fromPrivateKey
  > | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const providerRef = useRef<WalletProvider | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Validate private key length
      if (privateKey.length !== 64) {
        throw new Error("Private key must be 64 hex characters");
      }

      // Create key pair from private key
      const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, "hex"), {
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
      setPublicKey(keyPair.publicKey.toString());
      setKeyPair(keyPair);
      console.log("Address:", btcAddress);
      console.log("Public Key:", keyPair.publicKey.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid private key");
      setAddress("");
      setPublicKey("");
      setKeyPair(null);
    }
  };

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
        onGetPublicKey: () => {
          console.log(`Called on get pk`);
          if (!keyPair) throw new Error("No key pair loaded");
          return keyPair.publicKey.toString();
        },
        onGetDerivationPath: () => {
          console.log(`Called on get derivation path`);
          // For now, hardcode the derivation path
          // In a real wallet, this would come from the wallet's state
          return "m/84'/0'/0'/0/0";
        },
        onGetAddress: () => {
          console.log(`Called on get address`);
          if (!address) throw new Error("No address loaded");
          return address;
        },
        onGetNpub: () => {
          console.log(`Called on get npub`);
          // TODO: Implement Nostr npub conversion
          throw new Error("Nostr npub not yet implemented");
        },
        onSignPsbt: (psbt: string) => {
          console.log(`Called sign psbt ${psbt}`);
          // TODO: Implement PSBT signing
          throw new Error("PSBT signing not yet implemented");
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
        />
      </div>
    </div>
  );
}

export default App;
