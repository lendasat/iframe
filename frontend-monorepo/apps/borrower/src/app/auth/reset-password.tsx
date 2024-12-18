import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { ResetPasswordForm } from "@frontend-monorepo/ui-shared";
import { useParams } from "react-router-dom";

function ResetPassword() {
  const { resetPassword } = useBaseHttpClient();
  const { token } = useParams();

  const handleSubmit = async (password: string, confirmPassword: string) => {
    return await resetPassword(password, confirmPassword, token || "");
  };

  return <ResetPasswordForm handleSubmit={handleSubmit} loginUrl={"/login"} />;
}

export default ResetPassword;
