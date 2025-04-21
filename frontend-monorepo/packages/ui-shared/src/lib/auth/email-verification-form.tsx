import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { ShadcnEmailVerification } from "@frontend/shadcn";

interface EmailVerificationFormProps {
  handleVerification: (verificationCode: string) => Promise<void>;
  initialVerificationCode: string;
  onBack: () => void;
  loginLink: string;
  waitlistLink: string;
}

export function EmailVerificationForm({
  handleVerification,
  initialVerificationCode,
  onBack,
  loginLink,
  waitlistLink,
}: EmailVerificationFormProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex justify-center items-center w-full">
          <Logo
            height={40}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />
        </div>
        <ShadcnEmailVerification
          initialVerificationCode={initialVerificationCode}
          handleVerification={handleVerification}
          waitlistLink={waitlistLink}
          loginLink={loginLink}
          onBack={onBack}
        />
      </div>
    </div>
  );
}
