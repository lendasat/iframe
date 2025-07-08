import { useState } from "react";
import { Button } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/shadcn";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ForgotPasswordProps {
  handleSubmit: (email: string) => Promise<string>;
}

export function ForgotPasswordForm({ handleSubmit }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await handleSubmit(email);
      setSuccess(success);
    } catch (err) {
      console.error(`Failed resetting password: ${JSON.stringify(err)}`);
      setError(`Failed resetting password. ${JSON.stringify(err)}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-50 via-slate-50 to-pink-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo
            height={27}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Forgot your password?</CardTitle>
            <CardDescription>
              Worry not, we will send you reset instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@domain.com"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full -px-4"
                disabled={!email || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button variant={"link"} onClick={() => navigate("/login")}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForgotPasswordForm;
