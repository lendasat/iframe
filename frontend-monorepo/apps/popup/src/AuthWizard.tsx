import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { md5 } from "hash-wasm";
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
import {
  LoginResponseOrUpgrade,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  begin_registration,
  does_wallet_exist,
  load_wallet,
  new_wallet,
  persist_new_wallet,
  restore_wallet,
} from "browser-wallet";

interface AuthWizardProps {
  login: (email: string, password: string) => Promise<LoginResponseOrUpgrade>;
  inviteCode: string;
  onComplete: () => void;
}

const AuthWizard = ({ login, inviteCode, onComplete }: AuthWizardProps) => {
  // Step 1: Check if email exists and if it is verified.
  // Step 2(a): If exists + verified, log in with password.
  // Step 2(b): If does not exist, register with password.
  // Step 2(c): If exists + unverified, verify before login.
  // Step 3(optional): After registering, verify account.
  // Step 4: Done, contract request sent.
  const [currentStep, setCurrentStep] = useState(1);

  const [email, setEmail] = useState("borrower@lendasat.com");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const { getIsRegistered, register, verifyEmail } = useHttpClientBorrower();

  const handleNextStep = async () => {
    setError("");

    if (currentStep === 1) {
      // Validate email.
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address");
        return;
      }

      // Check if user is registered and verified.
      const res = await getIsRegistered(email);

      setIsRegistered(res.is_registered);
      setIsVerified(res.is_verified);

      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isRegistered) {
        // Register new user.

        if (!password) {
          setError("Please choose a password.");
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        let registrationData;
        try {
          registrationData = begin_registration(email, password);
        } catch (error) {
          if (error instanceof Error) {
            setError(
              `Failed to generate registration parameters: ${error.message}`,
            );
          } else {
            setError(`Failed to generate registration parameters: ${error}`);
          }

          return;
        }

        const network = import.meta.env.VITE_BITCOIN_NETWORK;

        let walletDetails;
        try {
          walletDetails = new_wallet(password, network);
        } catch (error) {
          if (error instanceof Error) {
            setError(`Failed to create wallet: ${error.message}`);
          } else {
            setError(`Failed to create wallet: ${error}`);
          }

          return;
        }

        try {
          await register(
            email,
            email,
            registrationData.verifier,
            registrationData.salt,
            {
              mnemonic_ciphertext: walletDetails.mnemonic_ciphertext,
              network: network,
            },
            inviteCode,
          );
        } catch (error) {
          if (error instanceof Error) {
            setError(`Failed to register: ${error.message}`);
          } else {
            setError(`Failed to register: ${error}`);
          }

          return;
        }

        try {
          const key = await md5(email);
          persist_new_wallet(
            walletDetails.mnemonic_ciphertext,
            walletDetails.network,
            key,
          );
        } catch (error) {
          if (error instanceof Error) {
            setError(`Failed to persist wallet: ${error.message}`);
          } else {
            setError(`Failed to persist wallet: ${error}`);
          }

          return;
        }

        // Time for email verification.
        setCurrentStep(3);
      } else {
        // Log in user.

        if (!password) {
          setError("Please enter your password.");
          return;
        }

        // TODO: This is an edge case where the user has an unverified account with us already. We
        // should add an API to ask for a new verification code.
        if (!isVerified) {
          setCurrentStep(3);
          return;
        }

        await logIn(email, password, login, (error: string) => {
          setError(error);
          return;
        });

        setCurrentStep(4);
        onComplete();
      }
    } else if (currentStep === 3) {
      // Validate verification code.
      if (!verificationCode || verificationCode.length != 6) {
        setError("Please enter a valid verification code.");
        return;
      }

      try {
        await verifyEmail(verificationCode);
      } catch (error) {
        if (error instanceof Error) {
          setError(`Failed to verify email: ${error.message}`);
        } else {
          setError(`Failed to verify email: ${error}`);
        }

        return;
      }

      await logIn(email, password, login, (error: string) => {
        setError(error);
        return;
      });

      setCurrentStep(4);
      onComplete();
    }
  };

  const handlePreviousStep = () => {
    setError("");

    // Always go back to the very beginning.
    setCurrentStep(1);
  };

  // Helper function to get content based on current step
  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <CardHeader>
              <CardTitle>Enter your email</CardTitle>
              <CardDescription>To register or log back in.</CardDescription>
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
              <CardTitle>
                {isRegistered ? "Welcome back!" : "Create your account"}
              </CardTitle>
              <CardDescription>
                {isRegistered
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
                      isRegistered ? "Enter your password" : "Create password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {!isRegistered && (
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

      case 3:
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

      case 4:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-center">
                {isRegistered ? "Welcome back!" : "Account created!"}
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
                    {isRegistered ? "Sign In" : "Create Account"}
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

async function logIn(
  email: string,
  password: string,
  loginFn: (email: string, password: string) => Promise<LoginResponseOrUpgrade>,
  onError: (error: string) => void,
) {
  let walletBackupData;
  try {
    const loginResponse = await loginFn(email, password);

    if ("must_upgrade_to_pake" in loginResponse) {
      onError("Please upgrade your account by logging in through Lendasat");
      return;
    }

    walletBackupData = loginResponse.wallet_backup_data;
  } catch (error) {
    if (error instanceof Error) {
      onError(`Failed to log in: ${error.message}`);
    } else {
      onError(`Failed to log in: ${error}`);
    }

    return;
  }

  const key = await md5(email);
  if (!does_wallet_exist(key)) {
    try {
      restore_wallet(
        key,
        walletBackupData.mnemonic_ciphertext,
        walletBackupData.network,
      );
    } catch (error) {
      if (error instanceof Error) {
        onError(`Failed to restore Lendasat wallet: ${error.message}`);
      } else {
        onError(`Failed to restore Lendasat wallet: ${error}`);
      }

      return;
    }
  }

  try {
    load_wallet(password, key);
  } catch (error) {
    if (error instanceof Error) {
      onError(`Failed to load Lendasat wallet: ${error.message}`);
    } else {
      onError(`Failed to load Lendasat wallet: ${error}`);
    }

    return;
  }

  console.log("Login successful");
}

export default AuthWizard;
