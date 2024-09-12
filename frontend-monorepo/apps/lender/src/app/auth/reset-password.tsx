import { useBorrowerHttpClient } from "@frontend-monorepo/http-client";
import { ResetPasswordForm } from "@frontend-monorepo/ui-shared";
import React from "react";
import { useParams } from "react-router-dom";

function ForgotPassword() {
  const { resetPassword } = useBorrowerHttpClient();
  const { token } = useParams();

  const handleSubmit = async (password: string, confirmPassword: string) => {
    return await resetPassword(password, confirmPassword, token);
  };

  return <ResetPasswordForm handleSubmit={handleSubmit} loginUrl={"/login"} />;
}

export default ForgotPassword;
