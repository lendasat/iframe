import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

type LoginState = {
  registered: boolean;
};
function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { registered } = location.state as LoginState || {};
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
    defaultUsername = import.meta.env.VITE_BORROWER_USERNAME;
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultPassword = import.meta.env.VITE_BORROWER_PASSWORD;
  }

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={defaultUsername}
      initialUserPassword={defaultPassword}
      infoMessage={registered ? "We have sent an verification email to your email address" : undefined}
    />
  );
}

export default Login;
