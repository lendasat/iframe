import { AuthIsNotSignedIn, AuthIsSignedIn, AuthProvider } from "@frontend-monorepo/http-client";
import { Layout } from "@frontend-monorepo/ui-shared";
import { Route, Routes } from "react-router-dom";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import DashBoard from "./dash-board";
import MyAccount from "./my-account";
import MyLoans from "./my-loans";
import Profile from "./profile";
import RequestLoan from "./request-loan/request-loan";
import { RequestLoanSummary } from "./request-loan/request-loan-summary";
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
    <AuthProvider baseUrl="http://localhost:7337">
      <AuthIsSignedIn>
        <Layout
          navItems={navItems}
          defaultActiveKey={"/my-account"}
        >
          <Routes>
            <Route index element={<DashBoard />} />
            <Route path="/request-loan" element={<RequestLoan />} />
            <Route path="/my-loans" element={<MyLoans />} />
            <Route path="/my-account" element={<MyAccount />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/request-loan/:id" element={<RequestLoanSummary />} />
          </Routes>
        </Layout>
      </AuthIsSignedIn>
      <AuthIsNotSignedIn>
        <Routes>
          <Route index element={<Login />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </AuthIsNotSignedIn>
    </AuthProvider>
  );
}

export default App;
