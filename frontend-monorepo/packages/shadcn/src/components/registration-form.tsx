import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { cn } from "#/lib/utils";
import { Label } from "@radix-ui/react-label";
import { Input } from "./ui/input";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "./ui/button";

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

interface RegistrationFormProps extends React.ComponentProps<"div"> {
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

export function ShadCnRegistrationForm({
  className,
  handleRegister,
  referralCode: defaultReferralCode,
  loginLink,
  waitlistLink,
  ...props
}: RegistrationFormProps) {
  if (
    defaultReferralCode === null &&
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest"
  ) {
    defaultReferralCode = "BETA_PHASE_1";
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [referralCode, setReferralCode] = useState<string>(
    defaultReferralCode || "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [isTouched, setIsTouched] = useState(false);

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);

    if (isTouched) {
      setIsEmailValid(validateEmail(value));
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
    setIsEmailValid(validateEmail(email));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    setError("");
    try {
      await handleRegister(name, email, password, referralCode);
    } catch (err) {
      console.error("Failed registering user:", err);
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
    setIsLoading(false);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Register</CardTitle>
          <CardDescription>To join the future of lending</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-6">
                {/*Name and Email */}
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  <div className="grid items-center gap-1.5">
                    <Label htmlFor="email">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Satoshi Nakamoto"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid items-center gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      value={email}
                      onBlur={handleBlur}
                      onChange={(e) => handleEmailChange(e)}
                      required
                    />
                  </div>
                </div>
                {/*Password and confirm password */}
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  <div className="grid items-center gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="flex w-full max-w-sm items-center space-x-2">
                      <Input
                        id="password"
                        type={isPasswordVisible ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant={"outline"}
                        size={"icon"}
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      >
                        {isPasswordVisible ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid items-center gap-1.5">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="flex w-full max-w-sm items-center space-x-2">
                      <Input
                        id="confirmPassword"
                        type={isConfirmPasswordVisible ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant={"outline"}
                        size={"icon"}
                        onClick={() =>
                          setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                        }
                      >
                        {isConfirmPasswordVisible ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid items-center gap-1.5">
                  <Label htmlFor="confirmPassword">Referral Code</Label>
                  <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                      id="referralCode"
                      type={"text"}
                      required
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                    />
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {!isEmailValid && isTouched && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      Please enter a valid email address.
                    </AlertDescription>
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
                    "Register"
                  )}
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
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By using this service, you agree to our{" "}
        <a href="https://tos.lendasat.com">Terms of Service</a>.
      </div>
    </div>
  );
}
