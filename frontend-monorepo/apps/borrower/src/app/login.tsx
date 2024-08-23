import { useAuth } from "@frontend-monorepo/http-client";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import React from "react";

function Login() {
  const { login } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  return <LoginForm handleLogin={handleLogin} registrationLink={"/registration"} />;
}

export default Login;
