import { FormEvent, useEffect, useState } from "react";
import init, { get_mnemonic, load_wallet, new_wallet } from "../../../../../borrower-wallet/pkg/borrower_wallet.js";

function App() {
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
      new_wallet(newWalletInput);
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
      <h1>Lendasat</h1>
      <div className="card">
        <form onSubmit={createWallet}>
          <input
            type="text"
            value={newWalletInput}
            onChange={(e) => setNewWalletInput(e.target.value)}
            placeholder="Passphrase"
          />
          <button type="submit">
            Create new wallet
          </button>
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
          <button type="submit">
            Load wallet
          </button>
        </form>
      </div>
      <div className="card">
        <button onClick={getMnemonic}>
          Get mnemonic
        </button>
        {mnemonic && <p>{mnemonic}</p>}
      </div>
    </>
  );
}

export default App;
