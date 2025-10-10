import './App.css'

function App() {
  return (
    <div className="app">
      <h1>Hello Wallet</h1>
      <iframe
        src="http://localhost:5173"
        title="Lendasat"
        className="lendasat-iframe"
      />
    </div>
  )
}

export default App
