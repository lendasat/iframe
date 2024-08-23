import { Layout } from "@frontend-monorepo/ui-shared";
import { Route, Routes } from "react-router-dom";
import MyAccount from "./my-account";
import MyLoans from "./my-loans";
import RequestLoan from "./request-loan";
import Wallet from "./wallet";

const navItems = [
  { href: "/request-loan", label: "Request a Loan" },
  { href: "/my-loans", label: "My Loans" },
  { href: "/my-account", label: "My Account" },
  { href: "/wallet", label: "Wallet" },
  { href: "/help", label: "Help" },
  { href: "/logout", label: "Logout" },
];

function App() {
  return (
    <Layout navItems={navItems} description={"Sell at the price you deserve"} title={"Welcome Borrower"}>
      <Routes>
        <Route path="/request-loan" element={<RequestLoan />} />
        <Route path="/my-loans" element={<MyLoans />} />
        <Route path="/my-account" element={<MyAccount />} />
        <Route path="/wallet" element={<Wallet />} />
      </Routes>
    </Layout>
  );
}

export default App;
