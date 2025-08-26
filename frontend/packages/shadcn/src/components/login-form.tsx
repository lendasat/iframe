import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { ComponentProps, type FormEvent, ReactNode, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";

export interface TotpRequired {
  totp_required: true;
  session_token: string;
}

interface LoginFormProps extends ComponentProps<"div"> {
  handleLogin: (
    email: string,
    password: string,
    totpCode?: string,
    sessionToken?: string,
  ) => Promise<TotpRequired | undefined>;
  registrationLink: string;
  forgotPasswordLink: string;
  initialUserEmail: string;
  initialUserPassword: string;
  infoMessage?: string;
  waitlistLink: string;
  cardDescription: ReactNode;
}

export function LoginForm({
  className,
  handleLogin,
  registrationLink,
  forgotPasswordLink,
  initialUserEmail,
  initialUserPassword,
  waitlistLink,
  cardDescription,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = useState(initialUserEmail);
  const [password, setPassword] = useState(initialUserPassword);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTotpStep, setShowTotpStep] = useState(false);
  const [sessionToken, setSessionToken] = useState("");

  const [visible, setVisible] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let result: TotpRequired | undefined;

      if (showTotpStep) {
        // TOTP verification step
        result = await handleLogin(email, password, totpCode, sessionToken);
      } else {
        // Initial login step
        result = await handleLogin(email, password);
      }

      // Check if TOTP is required
      if (result && "totp_required" in result) {
        setSessionToken(result.session_token);
        setShowTotpStep(true);
        setLoading(false);
        return;
      }

      // Login successful, handleLogin will handle navigation
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error("Error during login: ", err);
      setError(`Login failed: ${err}`);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {showTotpStep ? "Enter verification code" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {showTotpStep
              ? "Enter the 6-digit code from your authenticator app"
              : cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-6">
                {!showTotpStep ? (
                  <>
                    <div className="grid gap-3">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center">
                        <Label htmlFor="password">Password</Label>
                        <a
                          href={forgotPasswordLink}
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </a>
                      </div>
                      <div className="flex w-full max-w-sm items-center space-x-2">
                        <Input
                          id="password"
                          type={visible ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant={"outline"}
                          size={"icon"}
                          onClick={() => setVisible(!visible)}
                        >
                          {visible ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-3">
                    <Label htmlFor="totpCode">Verification Code</Label>
                    <Input
                      id="totpCode"
                      type="text"
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) =>
                        setTotpCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      maxLength={6}
                      className="text-center text-lg tracking-widest"
                      required
                    />
                    <div className="text-muted-foreground text-center text-sm">
                      Logging in as: {email}
                    </div>
                  </div>
                )}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <Button
                    type="submit"
                    className="w-full px-0"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Please wait
                      </>
                    ) : showTotpStep ? (
                      "Verify Code"
                    ) : (
                      "Login"
                    )}
                  </Button>
                  {showTotpStep && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowTotpStep(false);
                        setTotpCode("");
                        setSessionToken("");
                        setError("");
                      }}
                      disabled={loading}
                    >
                      Back to Login
                    </Button>
                  )}
                </div>
              </div>
              {!showTotpStep && (
                <div>
                  <div className="text-center text-sm">
                    Don&apos;t have an account?{" "}
                    <a
                      href={registrationLink}
                      className="underline underline-offset-4"
                    >
                      Sign up
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
              )}
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
