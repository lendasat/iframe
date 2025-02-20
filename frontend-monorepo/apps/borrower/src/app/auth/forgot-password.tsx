import { useBaseHttpClient } from "@frontend/base-http-client";
import { ForgotPasswordForm } from "@frontend/ui-shared";

function ForgotPassword() {
  const { forgotPassword } = useBaseHttpClient();

  const handleLogin = async (email: string) => {
    return await forgotPassword(email);
  };

  return <ForgotPasswordForm handleSubmit={handleLogin} />;
}

export default ForgotPassword;
