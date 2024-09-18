import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { ForgotPasswordForm } from "@frontend-monorepo/ui-shared";
import React from "react";

function ForgotPassword() {
  const { forgotPassword } = useBaseHttpClient();

  const handleLogin = async (email: string) => {
    return await forgotPassword(email);
  };

  return <ForgotPasswordForm handleSubmit={handleLogin} />;
}

export default ForgotPassword;
