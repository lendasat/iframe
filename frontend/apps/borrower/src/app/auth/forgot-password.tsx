import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { ForgotPasswordForm } from "@frontend/ui-shared";

function ForgotPassword() {
  const { forgotPassword } = useHttpClientBorrower();

  const handleLogin = async (email: string) => {
    return (await forgotPassword(email)) || "";
  };

  return <ForgotPasswordForm handleSubmit={handleLogin} />;
}

export default ForgotPassword;
