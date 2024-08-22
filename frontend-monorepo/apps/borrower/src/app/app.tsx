import { HeaderComponent } from "@frontend-monorepo/ui-shared";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Link, Route, Routes } from "react-router-dom";
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
      <HeaderComponent title={"Welcome Borrower"} />
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

      {/* START: routes */}
      {/* These routes and navigation have been generated for you */}
      {/* Feel free to move and update them to fit your needs */}
      <br />
      <hr />
      <br />
      <div role="navigation">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/page-2">Page 2</Link>
          </li>
        </ul>
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              This is the generated root route. <Link to="/page-2">Click here for page 2.</Link>
            </div>
          }
        />
        <Route
          path="/page-2"
          element={
            <div>
              <Link to="/">Click here to go back to root page.</Link>
            </div>
          }
        />
      </Routes>
      {/* END: routes */}
    </>
  );
}

export default App;
