import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { ShadCnRegistrationForm } from "@frontend/shadcn";

interface RegistrationFormProps {
  handleRegister: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<void>;
  referralCode: string | null;
  waitlistLink: string;
  loginLink: string;
}

export function RegistrationForm({
  handleRegister,
  referralCode: defaultReferralCode,
  waitlistLink,
  loginLink,
}: RegistrationFormProps) {
  if (
    defaultReferralCode === null &&
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest"
  ) {
    defaultReferralCode = "BETA_PHASE_1";
  }

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
        <ShadCnRegistrationForm
          handleRegister={handleRegister}
          referralCode={defaultReferralCode}
          waitlistLink={waitlistLink}
          loginLink={loginLink}
        />
      </div>
    </div>
  );
}
