import { useBaseHttpClient } from "@lendasat/base-http-client";
import { EmailVerificationForm } from "@lendasat/ui-shared";
import { useNavigate, useParams } from "react-router-dom";

function VerifyEmailForm() {
  const { verifyEmail } = useBaseHttpClient();
  const navigate = useNavigate();
  const { token } = useParams();

  const handleVerification = async (verificationCode: string) => {
    await verifyEmail(verificationCode);

    navigate("/login/verified");
  };

  return (
    <EmailVerificationForm
      handleVerification={handleVerification}
      initialVerificationCode={token || ""}
    />
  );
}

export default VerifyEmailForm;
