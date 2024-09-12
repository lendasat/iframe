import { useBorrowerHttpClient } from "@frontend-monorepo/http-client";
import { ForgotPasswordForm } from "@frontend-monorepo/ui-shared";
import React from "react";

function ForgotPassword() {
  const { forgotPassword } = useBorrowerHttpClient();

  const handleLogin = async (email: string) => {
    return await forgotPassword(email);
  };

  return <ForgotPasswordForm handleSubmit={handleLogin} />;
}

export default ForgotPassword;
