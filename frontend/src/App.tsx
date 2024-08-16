import viteLogo from "/vite.svg";
import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";
import init, { greet } from "../../borrower-wallet/pkg/borrower_wallet.js";

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function initializeWasm() {
      await init();
    }

    initializeWasm();
  }, []); // Empty dependency array means this runs once on mount

  const handleClick = () => {
    setCount((count) => {
      greet();
      return count + 1;
    });
  };

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={handleClick}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
