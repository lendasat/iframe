import { useState } from "react";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { Buffer } from "buffer";
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
      console.log("Address:", btcAddress);
      console.log("Public Key:", keyPair.publicKey.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid private key");
      setAddress("");
      setPublicKey("");
    }
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
        </div>
        <iframe
          src="http://localhost:5173"
          title="Lendasat"
          className="lendasat-iframe"
        />
      </div>
    </div>
  );
}

export default App;
