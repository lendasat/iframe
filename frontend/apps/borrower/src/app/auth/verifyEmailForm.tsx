import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { ReactComponent as Logo } from "./../../assets/lendasat_svg_logo_long.svg";
import { useNavigate, useParams } from "react-router-dom";
import { ShadcnEmailVerification } from "@frontend/shadcn";

function VerifyEmailForm() {
  const { verifyEmail } = useHttpClientBorrower();
  const navigate = useNavigate();
  const { token } = useParams();

  const handleVerification = async (verificationCode: string) => {
    await verifyEmail(verificationCode);

    navigate("/login/verified");
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex w-full items-center justify-center">
          <Logo
            height={40}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />
        </div>
        <ShadcnEmailVerification
          initialVerificationCode={token || ""}
          handleVerification={handleVerification}
          loginLink={"/login"}
          waitlistLink={"/waitlist"}
          onBack={() => navigate(-1)}
        />
      </div>
    </div>
  );
}

export default VerifyEmailForm;
