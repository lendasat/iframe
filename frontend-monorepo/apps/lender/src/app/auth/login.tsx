import { useAuth } from "@frontend-monorepo/http-client-lender";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import React from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    navigate("/");
  };

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={"lender@lendasat.com"}
      initialUserPassword={"password123"}
    />
  );
}

export default Login;
