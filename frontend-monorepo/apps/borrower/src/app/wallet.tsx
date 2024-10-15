import { useWallet } from "@frontend-monorepo/browser-wallet";
import { FormEvent, useState } from "react";
import { Button } from "react-bootstrap";

function Wallet() {
  const [mnemonic, setMnemonic] = useState<string>("");
  const [newWalletInput, setNewWalletInput] = useState<string>("");
  const [loadWalletInput, setLoadWalletInput] = useState<string>("");

  const { loadWallet, isWalletLoaded, createWallet, getMnemonic } = useWallet();

  const onCreateWallet = (e: FormEvent) => {
    e.preventDefault();

    try {
      createWallet(newWalletInput, import.meta.env.VITE_BITCOIN_NETWORK ?? "signet");
    } catch (e) {
      alert(e);
    }
  };

  const onLoadWallet = (e: FormEvent) => {
    e.preventDefault();

    try {
      loadWallet(loadWalletInput);
    } catch (e) {
      alert(e);
    }
  };

  const onGetMnemonic = (e: FormEvent) => {
    e.preventDefault();

    try {
      const mnemonicValue = getMnemonic();
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
        <form onSubmit={onCreateWallet}>
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
        <form onSubmit={onLoadWallet}>
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
        <Button onClick={onGetMnemonic}>
          Get mnemonic
        </Button>
        {mnemonic && <p>{mnemonic}</p>}
      </div>
    </>
  );
}

export default Wallet;
