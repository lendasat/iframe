import { useAuth } from "@frontend-monorepo/http-client";
import { ForgotPasswordForm, ResetPasswordForm } from "@frontend-monorepo/ui-shared";
import React from "react";
import { useParams } from "react-router-dom";

function ForgotPassword() {
  const { resetPassword } = useAuth();
  const { token } = useParams();

  const handleSubmit = async (password: string, confirmPassword: string) => {
    return await resetPassword(password, confirmPassword, token);
  };

  return <ResetPasswordForm handleSubmit={handleSubmit} loginUrl={"/login"} />;
}

export default ForgotPassword;
