import { useLenderHttpClient } from "@frontend/http-client-lender";
import { EmailVerificationForm } from "@frontend/ui-shared";
import { useNavigate, useParams } from "react-router-dom";

function VerifyEmailForm() {
  const { verifyEmail } = useLenderHttpClient();
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
      onBack={() => navigate(-1)}
      loginLink={"/login"}
      waitlistLink={"/waitlist"}
    />
  );
}

export default VerifyEmailForm;
