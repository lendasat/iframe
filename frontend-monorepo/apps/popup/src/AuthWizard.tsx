import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AuthWizard = () => {
  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState("borrower@lendasat.com");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [error, setError] = useState("");

  // Mock function to simulate checking if user exists
  const checkUserExists = (email: string) => {
    // For demo purposes, emails containing "existing" will be treated as existing users
    return email.includes("existing");
  };

  // Handle step transitions
  const handleNextStep = () => {
    setError("");

    if (currentStep === 1) {
      // Validate email
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address");
        return;
      }

      // Check if user exists (this would typically be an API call)
      const userExists = checkUserExists(email);
      setIsExistingUser(userExists);

      // Mock sending verification code
      console.log(`Verification code sent to ${email}`);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Validate verification code
      if (!verificationCode || verificationCode.length < 4) {
        setError("Please enter a valid verification code.");
        return;
      }

      // Proceed to step 3
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (isExistingUser) {
        // Existing user just needs password
        if (!password) {
          setError("Please enter your password.");
          return;
        }

        // Login successful
        console.log("Login successful");
        setCurrentStep(4);
      } else {
        // New user needs to create and confirm password
        if (!password) {
          setError("No password provided.");
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        // Account creation successful
        console.log("Account created successfully");
        setCurrentStep(4);
      }
    }
  };

  const handlePreviousStep = () => {
    setError("");
    if (currentStep > 1 && currentStep < 4) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Helper function to get content based on current step
  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <CardHeader>
              <CardTitle>Enter your email</CardTitle>
              <CardDescription>
                We will send a verification code to this address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </>
        );

      case 2:
        return (
          <>
            <CardHeader>
              <CardTitle>Verify your email</CardTitle>
              <CardDescription>
                Enter the verification code sent to {email}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
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

                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => console.log("Resend code")}
                >
                  Did not receive the code? Resend.
                </Button>
              </div>
            </CardContent>
          </>
        );

      case 3:
        return (
          <>
            <CardHeader>
              <CardTitle>
                {isExistingUser ? "Welcome back" : "Create your account"}
              </CardTitle>
              <CardDescription>
                {isExistingUser
                  ? "Enter your password to continue."
                  : "Choose a secure password for your new account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={
                      isExistingUser ? "Enter your password" : "Create password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {!isExistingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </>
        );

      case 4:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-center">
                {isExistingUser ? "Welcome back!" : "Account created!"}
              </CardTitle>
              <CardDescription className="text-center">
                Press next to go ahead with your loan.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCheck className="h-10 w-10 text-green-600" />
              </div>
            </CardContent>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card className="gap-3 p-4">
        {getStepContent()}

        {error && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        <CardFooter className="flex justify-between">
          {currentStep < 4 ? (
            <>
              <Button
                variant="outline"
                onClick={handlePreviousStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button onClick={handleNextStep}>
                {currentStep === 3 ? (
                  <>
                    {isExistingUser ? "Sign In" : "Create Account"}
                    <CheckCircle className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthWizard;
