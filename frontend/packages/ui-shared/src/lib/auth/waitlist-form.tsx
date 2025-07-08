import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Info, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
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

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof formSchema>;

interface WaitlistFormProps {
  handleRegister: (email: string) => Promise<void>;
}

export function WaitlistForm({ handleRegister }: WaitlistFormProps) {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setError("");

    try {
      await handleRegister(values.email);
    } catch (err) {
      console.error("Failed register in waitlist:", err);
      const msg = "Registration failed";
      setError(err instanceof Error ? `${msg}: ${err.message}` : msg);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = form.formState.isValid && form.watch("email");

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
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Join Waitlist
            </h1>
            <p className="text-foreground/80 font-light">
              Share your email with us and we will let you know once there's
              space for you.
            </p>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="example@domain.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  disabled={!isFormValid || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join"
                  )}
                </Button>
              </form>
            </Form>

            {/* Navigation Links */}
            <div className="mt-16 space-y-2">
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Already have an account?
                </span>
                <Link to="/login" className="text-sm font-medium">
                  Sign in
                </Link>
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Do you have an invite code?
                </span>
                <Link to="/registration" className="text-sm font-medium ">
                  Register here
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
