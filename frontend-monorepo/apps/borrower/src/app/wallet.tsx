import { FormEvent, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import init, { get_mnemonic, load_wallet, new_wallet } from "../../../../../borrower-wallet/pkg/borrower_wallet.js";

function Wallet() {
  const [mnemonic, setMnemonic] = useState<string>("");
  const [newWalletInput, setNewWalletInput] = useState<string>("");
  const [loadWalletInput, setLoadWalletInput] = useState<string>("");
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(false);

  useEffect(() => {
    async function initializeWasm() {
      await init();
    }

    initializeWasm();
  }, []); // Empty dependency array means this runs once on mount

  const createWallet = (e: FormEvent) => {
    e.preventDefault();

    try {
      // TODO: The network should be read from an environment variable.
      new_wallet(newWalletInput, import.meta.env.VITE_BITCOIN_NETWORK ?? "signet");
      setIsWalletLoaded(true);
    } catch (e) {
      alert(e);
    }
  };

  const loadWallet = (e: FormEvent) => {
    e.preventDefault();

    try {
      load_wallet(loadWalletInput);
      setIsWalletLoaded(true);
    } catch (e) {
      alert(e);
    }
  };

  const getMnemonic = () => {
    try {
      const mnemonicValue = get_mnemonic();
      setMnemonic(mnemonicValue);
    } catch (e) {
      alert(e);
    }
  };

  return (
    <>
      <div className="status-container">
        <div className="circle" style={{ backgroundColor: isWalletLoaded ? "green" : "grey" }}></div>
        <span>Wallet status</span>
      </div>
      <div className="card">
        <form onSubmit={createWallet}>
          <input
            type="text"
            value={newWalletInput}
            onChange={(e) => setNewWalletInput(e.target.value)}
            placeholder="Passphrase"
          />
          <Button type="submit">
            Create new wallet
          </Button>
        </form>
      </div>
      <div className="card">
        <form onSubmit={loadWallet}>
          <input
            type="text"
            value={loadWalletInput}
            onChange={(e) => setLoadWalletInput(e.target.value)}
            placeholder="Passphrase"
          />
          <Button type="submit">
            Load wallet
          </Button>
        </form>
      </div>
      <div className="card">
        <Button onClick={getMnemonic}>
          Get mnemonic
        </Button>
        {mnemonic && <p>{mnemonic}</p>}
      </div>
    </>
  );
}

export default Wallet;
