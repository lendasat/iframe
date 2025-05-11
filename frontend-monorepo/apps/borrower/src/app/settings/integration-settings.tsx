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
} from "@frontend/shadcn";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { toast } from "sonner";
import { useAsync } from "react-use";
import { LuCheck } from "react-icons/lu";

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const { value: hasKey } = useAsync(async () => {
    return await hasBringinApiKey();
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    postBringinConnect(values.email).then(
      (res) => {
        if (res && res.signup_url) {
          toast.info(
            "Check your emails to register with Bringin and complete the connection.",
            { duration: 30000 },
          );
        } else {
          toast.success(
            "Check your emails to authorize connecting your Bringin account with Lendasat.",
            { duration: 30000 },
          );
        }
      },
      () => {
        toast.error("Failed to connect with Bringin.");
      },
    );
  }

  if (hasKey) {
    return (
      <div className="flex gap-2">
        <LuCheck />
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
                  <Input placeholder="example@bringin.com" {...field} />
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
        <Button type="submit">Connect</Button>
      </form>
    </Form>
  );
}
