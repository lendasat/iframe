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
import { type FormEvent, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";

interface LoginFormProps extends React.ComponentProps<"div"> {
  handleLogin: (email: string, password: string) => Promise<void>;
  registrationLink: string;
  forgotPasswordLink: string;
  initialUserEmail: string;
  initialUserPassword: string;
  infoMessage?: string;
  waitlistLink: string;
}

export function LoginForm({
  className,
  handleLogin,
  registrationLink,
  forgotPasswordLink,
  initialUserEmail,
  initialUserPassword,
  waitlistLink,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = useState(initialUserEmail);
  const [password, setPassword] = useState(initialUserPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [visible, setVisible] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleLogin(email, password);
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
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Welcome back! Please enter your details...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-6">
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
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Please wait
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </div>
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
