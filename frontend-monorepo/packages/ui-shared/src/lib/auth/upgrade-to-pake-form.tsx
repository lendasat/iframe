import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@frontend/shadcn";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { Card, CardContent, CardHeader } from "@frontend/shadcn";
import { ReactComponent as Logo } from "./../assets/lendasat_svg_logo.svg";

const formSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    oldPassword: z.string().min(1, "Current password is required"),
    contractSecret: z.string().min(1, "Contract secret is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

interface UpgradeToPakeFormProps {
  handleFormSubmission: (
    email: string,
    oldPassword: string,
    contractSecret: string,
    newPassword: string,
  ) => Promise<void>;
}

export function UpgradeToPakeForm({
  handleFormSubmission,
}: UpgradeToPakeFormProps) {
  const [isOldPasswordVisible, setIsOldPasswordVisible] = useState(false);
  const [isContractSecretVisible, setContractSecretVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      oldPassword: "",
      contractSecret: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setError("");

    try {
      await handleFormSubmission(
        values.email,
        values.oldPassword,
        values.contractSecret,
        values.newPassword,
      );
    } catch (err) {
      console.error("Failed upgrading user to PAKE:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Upgrade to PAKE failed. Please reach out to support and do not delete your browser storage.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordToggle = ({
    isVisible,
    onToggle,
  }: {
    isVisible: boolean;
    onToggle: () => void;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
      onClick={onToggle}
      tabIndex={-1}
    >
      {isVisible ? (
        <Eye className="h-4 w-4 text-muted-foreground" />
      ) : (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center overflow-y-auto">
      <div className="w-full max-w-lg p-5">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo
            height={27}
            width="auto"
            className="w-fit invert dark:invert-0"
          />
        </div>

        <Card className="w-full shadow-lg">
          <CardHeader className="text-center pb-4">
            <h1 className="text-2xl font-bold text-foreground">
              Choose a new password
            </h1>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Good news!</strong> Lendasat is getting <em>simpler</em>
                .
              </p>
              <p>
                We have updated the app and you no longer need to remember both
                a password <em>and</em> a contract secret. You will now use a{" "}
                <strong>single password</strong> to authenticate and secure your
                wallet.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your email"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Current Password */}
                <FormField
                  control={form.control}
                  name="oldPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={isOldPasswordVisible ? "text" : "password"}
                            placeholder="Current Password"
                            {...field}
                          />
                          <PasswordToggle
                            isVisible={isOldPasswordVisible}
                            onToggle={() =>
                              setIsOldPasswordVisible(!isOldPasswordVisible)
                            }
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contract Secret */}
                <FormField
                  control={form.control}
                  name="contractSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Secret</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={isContractSecretVisible ? "text" : "password"}
                            placeholder="Enter your contract secret"
                            {...field}
                          />
                          <PasswordToggle
                            isVisible={isContractSecretVisible}
                            onToggle={() =>
                              setContractSecretVisible(!isContractSecretVisible)
                            }
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* New Password and Confirm Password */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={isNewPasswordVisible ? "text" : "password"}
                              placeholder="New Password"
                              {...field}
                            />
                            <PasswordToggle
                              isVisible={isNewPasswordVisible}
                              onToggle={() =>
                                setIsNewPasswordVisible(!isNewPasswordVisible)
                              }
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmNewPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={isNewPasswordVisible ? "text" : "password"}
                              placeholder="Confirm Password"
                              {...field}
                            />
                            <PasswordToggle
                              isVisible={isNewPasswordVisible}
                              onToggle={() =>
                                setIsNewPasswordVisible(!isNewPasswordVisible)
                              }
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full -px-4"
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
