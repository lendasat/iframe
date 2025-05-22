import { useState, useEffect } from "react";
import { Button } from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import { CircleCheck, Clipboard, Loader, LockIcon } from "lucide-react";
import { Edit, Check, X } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Network, validate } from "bitcoin-address-validation";
import {
  Contract,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { toast } from "sonner";
import { SignedMessage, useWallet } from "@frontend/browser-wallet";
import PasswordDialog from "./unlock-wallet-dialog";

// Define props interface
interface EditableAddressFieldProps {
  contract?: Contract;
  refundAddress: string | undefined;
  shortenAddress: (address?: string) => string | undefined;
  handleCopy: (
    text: string,
    setCopiedState: (
      value: ((prevState: boolean) => boolean) | boolean,
    ) => void,
  ) => Promise<void>;
  refreshContract: () => void;
}

// Define Zod schema for Bitcoin address validation
const formSchema = z.object({
  bitcoinAddress: z.string().min(1, "Address is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditableAddressField({
  contract,
  refundAddress,
  shortenAddress,
  handleCopy,
  refreshContract,
}: EditableAddressFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [refundAddressCopied, setRefundAddressCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateBorrowerBtcAddress } = useHttpClientBorrower();
  const { isWalletLoaded, signMessageWithPassword, signMessage } = useWallet();

  const contractId = contract?.id;

  // Initialize React Hook Form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bitcoinAddress: refundAddress || "",
    },
  });

  // Debug: Log form errors whenever they change
  const formErrors = form.formState.errors;
  useEffect(() => {
    if (Object.keys(formErrors).length > 0) {
      console.log("Form errors:", formErrors);
    }
  }, [formErrors]);

  const startEditing = () => {
    form.reset({ bitcoinAddress: refundAddress || "" });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    form.reset();
  };

  const validateBitcoinAddress = (address: string): boolean => {
    console.log(`Validating bitcoin address: ${address}`);
    let network = Network.mainnet;
    if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
      network = Network.testnet;
    } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
      network = Network.regtest;
    }

    const isValid = validate(address, network);
    console.log(`Bitcoin address validation result: ${isValid}`);
    return isValid;
  };

  const submitAddressWithOrWithoutPassword = async (
    values: FormValues,
    password?: string,
  ) => {
    console.log("Form submitted with values:", values);
    setIsSubmitting(true);

    try {
      if (!contractId) {
        console.warn("No contractId provided, cannot proceed");
        return;
      }

      const address = values.bitcoinAddress;
      console.log("Validating address:", address);
      const isValid = validateBitcoinAddress(address);

      if (!isValid) {
        console.log("Address validation failed, setting error");
        form.setError("bitcoinAddress", {
          type: "manual",
          message: "Invalid bitcoin address",
        });
        // Keep the form open when validation fails
        setIsSubmitting(false);
        return;
      }

      console.log("Address valid, submitting to API");

      // If password is provided, we use it for signing
      let signedMessage: SignedMessage;
      if (password) {
        signedMessage = await signMessageWithPassword(
          password,
          address,
          contract?.borrower_pk,
          contract?.borrower_derivation_path,
        );
      } else {
        signedMessage = await signMessage(
          address,
          contract?.borrower_pk,
          contract?.borrower_derivation_path,
        );
      }

      await updateBorrowerBtcAddress(
        contractId,
        address,
        signedMessage.message.toString(),
        signedMessage.recoverableSignatureHex.toString(),
        signedMessage.recoverableSignatureId,
      );
      console.log("API call successful");
      toast.success("Address updated successfully");
      refreshContract();

      // Only close the form after successful submission
      setIsEditing(false);
    } catch (error) {
      console.error("Error during submission:", error);
      form.setError("bitcoinAddress", {
        type: "manual",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    await submitAddressWithOrWithoutPassword(values);
  };

  // Function to handle password dialog submission
  const handlePasswordSubmit = async (password: string) => {
    const formValues = form.getValues();

    await submitAddressWithOrWithoutPassword(formValues, password);
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">Refund Address</span>
      <div className="flex items-center">
        {isEditing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="relative">
              <FormField
                control={form.control}
                name="bitcoinAddress"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    {" "}
                    <FormControl>
                      <Input
                        {...field}
                        className="pr-16 font-medium w-[200px]"
                        placeholder="Enter bitcoin address"
                        autoFocus
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )}
              />
              <div className="absolute right-1 top-1 flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={cancelEditing}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 text-gray-500" />
                </Button>
                {isWalletLoaded && (
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                )}
                {!isWalletLoaded && (
                  <PasswordDialog onPasswordSubmit={handlePasswordSubmit}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={isSubmitting}
                      type="button"
                    >
                      {isSubmitting ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
                  </PasswordDialog>
                )}
              </div>
            </form>
          </Form>
        ) : (
          <>
            {refundAddress ? (
              <p className="font-medium">{shortenAddress(refundAddress)}</p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1"
              onClick={() =>
                handleCopy(refundAddress || "", setRefundAddressCopied)
              }
            >
              {refundAddressCopied ? (
                <CircleCheck className="h-4 w-4" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 ml-1"
              onClick={startEditing}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
