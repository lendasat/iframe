import { useLenderHttpClient } from "@frontend/http-client-lender";
import { ForgotPasswordForm } from "@frontend/ui-shared";

function ForgotPassword() {
  const { forgotPassword } = useLenderHttpClient();

  const handleLogin = async (email: string) => {
    return await forgotPassword(email);
  };

  return <ForgotPasswordForm handleSubmit={handleLogin} />;
}

export default ForgotPassword;
