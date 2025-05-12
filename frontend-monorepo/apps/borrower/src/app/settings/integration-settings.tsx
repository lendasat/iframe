import { useForm } from "react-hook-form";
import {
  Input,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Alert,
  AlertDescription,
} from "@frontend/shadcn";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { toast } from "sonner";
import { useAsync } from "react-use";
import { LuCheck, LuLoader } from "react-icons/lu";
import { useState } from "react";
import { AlertCircle } from "lucide-react";

export function IntegrationSettings() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Bringin</CardTitle>
        <CardDescription>
          In order to receive Euros in your Bringin account, you need to connect
          it with Lendasat.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BringinForm />
      </CardContent>
    </Card>
  );
}

const formSchema = z.object({
  email: z.string().email(),
});

export function BringinForm() {
  const { postBringinConnect, hasBringinApiKey } = useHttpClientBorrower();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const { value: hasKey, loading: isCheckingKey } = useAsync(async () => {
    try {
      return await hasBringinApiKey();
    } catch (err) {
      setError("Failed to check Bringin connection status.");
      return false;
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await postBringinConnect(values.email);

      if (res && res.signup_url) {
        const errorMessage =
          "Check your emails to register with Bringin and complete the connection.";
        setSuccess(errorMessage);
        toast.info(errorMessage, { duration: 30000 });
      } else {
        const successMessage =
          "Check your emails to authorize connecting your Bringin account with Lendasat.";
        setSuccess(successMessage);
        toast.success(successMessage, { duration: 30000 });
      }

      form.reset();
    } catch (err) {
      console.error(err);
      const errorMessage =
        "Failed to connect with Bringin. Please try again later.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  if (isCheckingKey) {
    return (
      <div className="flex items-center gap-2">
        Checking connection status...
      </div>
    );
  }

  if (hasKey) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <LuCheck className="h-5 w-5" />
        <Label>Your Bringin account is already connected with Lendasat.</Label>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>
                  <div className={"flex items-center gap-2"}>Bringin email</div>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="example@bringin.com"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Provide the email address you used to register with Bringin.
                  If you don't have an account, this will kickstart the
                  registration process for you.
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <LuLoader className="animate-spin" />
              Please wait
            </>
          ) : (
            "Connect"
          )}
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success">
            <LuCheck className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </form>
    </Form>
  );
}
