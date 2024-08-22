import { Route, Routes } from "react-router-dom";
import MyAccount from "./my-account";
import MyLoans from "./my-loans";
import RequestLoan from "./request-loan";
import Wallet from "./wallet";

function App() {
  return (
    <>
      <Routes>
        <Route path="/request-loan" element={<RequestLoan />} />
        <Route path="/my-loans" element={<MyLoans />} />
        <Route path="/my-account" element={<MyAccount />} />
        <Route path="/wallet" element={<Wallet />} />
      </Routes>
    </>
  );
}

export default App;
