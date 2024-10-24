import { useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { ResetPasswordForm } from "@frontend-monorepo/ui-shared";
import { useParams } from "react-router-dom";

function ForgotPassword() {
  const { resetPassword } = useLenderHttpClient();
  const { token } = useParams();

  const handleSubmit = async (password: string, confirmPassword: string) => {
    return await resetPassword(password, confirmPassword, token);
  };

  return <ResetPasswordForm handleSubmit={handleSubmit} loginUrl={"/login"} />;
}

export default ForgotPassword;
