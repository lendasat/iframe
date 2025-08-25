import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import {
  LoginResponseOrTotpRequired,
  PakeVerifiedResponse,
  TotpRequired,
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
import { md5CaseInsensitive } from "@frontend/browser-wallet";
import { WalletBackupData } from "@frontend/base-http-client";

type FormState = "initial" | "login" | "register" | "verify" | "success";

interface AuthFormProps {
  login: (
    email: string,
    password: string,
  ) => Promise<LoginResponseOrTotpRequired>;
  inviteCode: string;
  onComplete: () => void;
}

// Form schemas
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string().optional(),
  verificationCode: z.string().optional(),
});

const AuthForm = ({ login, inviteCode, onComplete }: AuthFormProps) => {
  const [formState, setFormState] = useState<FormState>("initial");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [_, setIsEmailVerified] = useState(false);
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);

  const { getIsRegistered, register, verifyEmail } = useHttpClientBorrower();

  // Set default values for development environments
  let defaultUsername = "";
  let defaultPassword = "";
  if (
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest" ||
    import.meta.env.VITE_BITCOIN_NETWORK === "signet"
  ) {
    defaultUsername = import.meta.env.VITE_BORROWER_USERNAME;
    defaultPassword = import.meta.env.VITE_BORROWER_PASSWORD;
  }

  // Setup form with zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultUsername,
      password: defaultPassword,
      confirmPassword: defaultPassword,
      verificationCode: "",
    },
  });

  // Add dynamic validation for password confirmation
  useEffect(() => {
    if (formState === "register") {
      form.register("confirmPassword", {
        validate: (value) =>
          value === form.getValues("password") || "Passwords do not match",
      });
    }
  }, [formState, form]);

  // Check the email when entered
  const checkEmail = async (email: string) => {
    if (!email || !email.includes("@")) return;

    try {
      setIsLoading(true);
      setError("");

      const res = await getIsRegistered(email);
      setIsUserRegistered(res.is_registered);
      setIsEmailVerified(res.is_verified);
      setEmailChecked(true);

      // Update form state based on user status
      if (res.is_registered) {
        setFormState(res.is_verified ? "login" : "verify");
      } else {
        setFormState("register");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle email blur to check status
  const handleEmailBlur = async () => {
    const email = form.getValues("email");
    if (email && !emailChecked) {
      await checkEmail(email);
    }
  };

  // Handle form submission
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setError("");
    setIsLoading(true);

    try {
      // If email hasn't been checked yet, check it first
      if (!emailChecked) {
        await checkEmail(data.email);
        setIsLoading(false);
        return;
      }

      // Handle based on the current form state
      switch (formState) {
        case "login":
          await handleLogin(data);
          break;
        case "register":
          await handleRegister(data);
          break;
        case "verify":
          await handleVerify(data);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login flow
  const handleLogin = async (data: z.infer<typeof formSchema>) => {
    await logIn(data.email, data.password, login);
    setFormState("success");
    onComplete();
  };

  // Handle registration flow
  const handleRegister = async (data: z.infer<typeof formSchema>) => {
    // Validate password confirmation
    if (data.password !== data.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // Begin registration process
    const registrationData = begin_registration(data.email, data.password);
    const network = import.meta.env.VITE_BITCOIN_NETWORK;
    const walletDetails = new_wallet(data.password, network);

    // Register the user
    await register(
      "Anon",
      data.email,
      registrationData.verifier,
      registrationData.salt,
      {
        mnemonic_ciphertext: walletDetails.mnemonic_ciphertext,
        network: network,
      },
      inviteCode,
    );

    // Persist the wallet
    const key = await md5CaseInsensitive(data.email);
    persist_new_wallet(
      walletDetails.mnemonic_ciphertext,
      walletDetails.network,
      key,
    );

    // Move to verification step
    setFormState("verify");
  };

  // Handle verification flow
  const handleVerify = async (data: z.infer<typeof formSchema>) => {
    if (!data.verificationCode || data.verificationCode.length !== 6) {
      throw new Error("Please enter a valid verification code");
    }

    // Verify the email
    await verifyEmail(data.verificationCode);

    // Log the user in
    await logIn(data.email, data.password, login);

    setFormState("success");
    onComplete();
  };

  // Helper function to reset the form
  const resetForm = () => {
    form.reset();
    setFormState("initial");
    setError("");
    setEmailChecked(false);
  };

  // Get the title and description based on the current form state
  const getCardHeader = () => {
    switch (formState) {
      case "initial":
        return {
          title: "Welcome",
          description: "Enter your email to get started",
        };
      case "login":
        return {
          title: "Welcome back",
          description: "Enter your password to continue",
        };
      case "register":
        return {
          title: "Create your account",
          description: "Choose a secure password for your new account",
        };
      case "verify":
        return {
          title: "Verify your email",
          description: `Enter the verification code sent to ${form.getValues("email")}`,
        };
      case "success":
        return {
          title: isUserRegistered ? "Welcome back!" : "Account created!",
          description: "Press continue to go ahead with your loan",
        };
    }
  };

  const header = getCardHeader();

  return (
    <div className="mx-auto max-w-md">
      <Card className="gap-3 p-4">
        <CardHeader>
          <CardTitle>{header.title}</CardTitle>
          <CardDescription>{header.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {formState !== "success" ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* Email field (always shown in initial state, read-only otherwise) */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="you@example.com"
                          type="email"
                          autoComplete="email"
                          disabled={formState !== "initial" && emailChecked}
                          onBlur={() => {
                            field.onBlur();
                            handleEmailBlur();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password field (shown for login and register) */}
                {(formState === "login" ||
                  formState === "register" ||
                  formState === "verify") && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            autoComplete={
                              formState === "register"
                                ? "new-password"
                                : "current-password"
                            }
                            placeholder={
                              formState === "register"
                                ? "Create password"
                                : "Enter password"
                            }
                            disabled={formState === "verify"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Confirm password (shown only for register) */}
                {(formState === "register" || formState === "verify") && (
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            autoComplete="new-password"
                            placeholder="Confirm password"
                            disabled={formState === "verify"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Verification code (shown only for verify) */}
                {formState === "verify" && (
                  <FormField
                    control={form.control}
                    name="verificationCode"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <FormLabel>Verification code</FormLabel>
                        <FormControl>
                          <div className="flex flex-col items-center">
                            <InputOTP
                              maxLength={6}
                              value={field.value || ""}
                              onChange={field.onChange}
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
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Error message */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Action buttons */}
                <div className="flex justify-between pt-2">
                  {formState !== "initial" && formState !== "success" && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={resetForm}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className={formState === "initial" ? "w-full" : ""}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Processing..."
                      : formState === "login"
                        ? "Sign In"
                        : formState === "register"
                          ? "Create Account"
                          : formState === "verify"
                            ? "Verify & Continue"
                            : "Continue"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <Button onClick={onComplete} className="w-full">
                Continue to Loan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Function to handle login logic with wallet management
async function logIn(
  email: string,
  password: string,
  loginFn: (
    email: string,
    password: string,
  ) => Promise<TotpRequired | PakeVerifiedResponse>,
) {
  let walletBackupData: WalletBackupData;
  try {
    const loginResponse = await loginFn(email, password);

    if ("totp_required" in loginResponse) {
      throw new Error(`TOTP required which is not supported yet`);
    }

    walletBackupData = loginResponse.wallet_backup_data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to log in: ${error.message}`);
    } else {
      throw new Error(`Failed to log in: ${error}`);
    }
  }

  const key = await md5CaseInsensitive(email);
  if (!does_wallet_exist(key)) {
    try {
      restore_wallet(
        key,
        walletBackupData.mnemonic_ciphertext,
        walletBackupData.network,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to restore Lendasat wallet: ${error.message}`);
      } else {
        throw new Error(`Failed to restore Lendasat wallet: ${error}`);
      }
    }
  }

  try {
    load_wallet(password, key);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load Lendasat wallet: ${error.message}`);
    } else {
      throw new Error(`Failed to load Lendasat wallet: ${error}`);
    }
  }

  console.log("Login successful");
}

export default AuthForm;
