import { useState } from "react";
import "./App.css";

function App() {
  const [privateKey, setPrivateKey] = useState(
    "0000000000000000000000000000000000000000000000000000000000000001",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Private key submitted:", privateKey);
    // Here you would typically derive the public key and send to iframe
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
              placeholder="Enter private key"
              className="private-key-input"
            />
            <button type="submit" className="submit-button">
              Load Wallet
            </button>
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
