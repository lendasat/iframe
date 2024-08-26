import { AuthProvider, useAuth } from "@frontend-monorepo/http-client";
import { Layout } from "@frontend-monorepo/ui-shared";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./login";
import Logout from "./logout";
import MyAccount from "./my-account";
import MyLoans from "./my-loans";
import Registration from "./registration";
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

function LoggedInComponents() {
  return (
    <Layout navItems={navItems} description={"Sell at the price you deserve"} title={"Welcome Borrower"}>
      <Routes>
        <Route path="/request-loan" element={<RequestLoan />} />
        <Route path="/my-loans" element={<MyLoans />} />
        <Route path="/my-account" element={<MyAccount />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="*" element={<Navigate to="/my-account" replace />} />
      </Routes>
    </Layout>
  );
}

function LoggedOutComponents() {
  return (
    <Routes>
      <Route path="/registration" element={<Registration />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider baseUrl="http://localhost:7337">
      <AuthStatus />
    </AuthProvider>
  );
}

const AuthStatus = () => {
  const { token } = useAuth();

  return token ? <LoggedInComponents /> : <LoggedOutComponents />;
};

export default App;
