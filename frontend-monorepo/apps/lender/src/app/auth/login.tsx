import { useAuth } from "@frontend-monorepo/http-client-lender";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const oldPath = location.pathname;

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    if (oldPath) {
      navigate(oldPath);
    } else {
      navigate("/");
    }
  };

  let defaultUsername = "";
  let defaultPassword = "";
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultUsername = import.meta.env.VITE_LENDER_USERNAME || "lender@lendasat.com";
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultPassword = import.meta.env.VITE_LENDER_PASSWORD || "password123";
  }

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={defaultUsername}
      initialUserPassword={defaultPassword}
    />
  );
}

export default Login;
