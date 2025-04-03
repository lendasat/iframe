import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { LoginForm as ShadCnLoginForm } from "@frontend/shadcn";

interface LoginFormProps {
  handleLogin: (email: string, password: string) => Promise<void>;
  registrationLink: string;
  forgotPasswordLink: string;
  initialUserEmail: string;
  initialUserPassword: string;
  infoMessage?: string;
  waitlistLink: string;
}

export function LoginForm({
  handleLogin,
  registrationLink,
  forgotPasswordLink,
  initialUserEmail,
  initialUserPassword,
  infoMessage,
  waitlistLink,
}: LoginFormProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center items-center w-full">
          <Logo
            height={40}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />
        </div>
        <ShadCnLoginForm
          forgotPasswordLink={forgotPasswordLink}
          initialUserEmail={initialUserEmail}
          initialUserPassword={initialUserPassword}
          registrationLink={registrationLink}
          infoMessage={infoMessage}
          handleLogin={handleLogin}
          waitlistLink={waitlistLink}
        />
      </div>
    </div>
  );
}

export default LoginForm;
