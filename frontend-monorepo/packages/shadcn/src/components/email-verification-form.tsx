import type { FormEvent } from "react";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { cn } from "#/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "./ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "#/components/ui/input-otp";

interface ShadcnEmailVerificationProps extends React.ComponentProps<"div"> {
  handleVerification: (verificationCode: string) => Promise<void>;
  initialVerificationCode: string;
  onBack: () => void;
  loginLink: string;
  waitlistLink: string;
}

export function ShadcnEmailVerification({
  className,
  handleVerification,
  initialVerificationCode,
  onBack,
  loginLink,
  waitlistLink,
  ...props
}: ShadcnEmailVerificationProps) {
  const [verificationCode, setVerificationCode] = useState(
    initialVerificationCode,
  );
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await handleVerification(verificationCode);
    } catch (err) {
      console.error("Failed to verify email:", err);
      setError(
        err instanceof Error ? err.message : "Verification failed failed.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verify Email</CardTitle>
          <CardDescription>
            Check your email for the verification code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-6">
                <div className="flex items-center justify-center">
                  <InputOTP
                    maxLength={6}
                    onChange={(e) => setVerificationCode(e)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="w-full px-0"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Please wait
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
                <Button variant={"link"} onClick={() => onBack()}>
                  Go Back
                </Button>
              </div>
              <div>
                <div className="text-center text-sm">
                  Have an account?{" "}
                  <a href={loginLink} className="underline underline-offset-4">
                    Login
                  </a>
                </div>
                <div className="text-center text-sm">
                  Don&apos;t have an invite code? Join our{" "}
                  <a
                    href={waitlistLink}
                    className="underline underline-offset-4"
                  >
                    Waitlist
                  </a>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary *:[a]:underline *:[a]:underline-offset-4 text-balance text-center text-xs">
        By using this service, you agree to our{" "}
        <a href="https://tos.lendasat.com">Terms of Service</a>.
      </div>
    </div>
  );
}
