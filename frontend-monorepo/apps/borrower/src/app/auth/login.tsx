import { useAuth, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
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

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    navigate("/");
  };

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={"borrower@lendasat.com"}
      initialUserPassword={"password123"}
      infoMessage={registered ? "We have sent an verification email to your email address" : undefined}
    />
  );
}

export default Login;
