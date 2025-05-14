import { ReactNode, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Accordion,
  AccordionTrigger,
  AccordionContent,
  Switch,
  AccordionItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  CardFooter,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useWallet } from "@frontend/browser-wallet";
import {
  FiatLoanDetails,
  IbanTransferDetails,
  SwiftTransferDetails,
} from "@frontend/base-http-client";
import { toast } from "sonner";

// Define the zod schema
const bankDetailsSchema = z.object({
  isIban: z.boolean(),
  iban: z
    .string()
    .optional()
    .refine((val) => !val || val.length > 0, {
      message: "IBAN is required when IBAN is selected",
      path: ["iban"],
    }),
  bic: z.string().optional(),
  account_number: z
    .string()
    .optional()
    .refine((val) => !val || val.length > 0, {
      message: "Account number is required when account number is selected",
      path: ["account_number"],
    }),
  swift: z.string().optional(),
  bankName: z.string().min(1, { message: "Bank name is required" }),
  bankAddress: z.string().min(1, { message: "Bank address is required" }),
  bankCountry: z.string().min(1, { message: "Bank country is required" }),
  purpose: z.string().min(1, { message: "Purpose is required" }),
});

const beneficiaryDetailsSchema = z.object({
  fullName: z.string().min(1, { message: "Full name is required" }),
  address: z.string().min(1, { message: "Address is required" }),
  city: z.string().min(1, { message: "City is required" }),
  zipCode: z.string().min(1, { message: "Zip code is required" }),
  country: z.string().min(1, { message: "Country is required" }),
  additionalComments: z.string().optional(),
});

const formSchema = z.object({
  bankDetails: bankDetailsSchema,
  beneficiaryDetails: beneficiaryDetailsSchema,
});

// Types based on the schema
type FormValues = z.infer<typeof formSchema>;

// TODO: fill in more countries
const countries = [
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Switzerland",
  "Canada",
  "Australia",
  "Japan",
  "China",
  "Brazil",
  "India",
  "Singapore",
];

interface AddFiatDetailsDialogProps {
  children: ReactNode;
  onComplete: (data: FiatLoanDetails) => void;
  borrowerPk: string;
  lenderPk: string;
}

const AddFiatDetailsDialog = ({
  children,
  onComplete,
  lenderPk,
  borrowerPk,
}: AddFiatDetailsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [approveError, setApproveError] = useState<string | undefined>();
  const { encryptFiatLoanDetailsLender } = useWallet();

  const [step, setStep] = useState<"bank" | "beneficiary" | "review">("bank");
  const [expandedItems, setExpandedItems] = useState<string[]>([
    "bank-details",
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bankDetails: {
        isIban: true,
        iban: "",
        bic: "",
        bankName: "",
        bankAddress: "",
        bankCountry: "",
        purpose: "",
      },
      beneficiaryDetails: {
        fullName: "",
        address: "",
        city: "",
        zipCode: "",
        country: "",
        additionalComments: "",
      },
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.

    setApproveError(undefined);
    setIsAccepting(true);

    try {
      let ibanTransferDetails: IbanTransferDetails | undefined = undefined;
      let swiftTransferDetails: SwiftTransferDetails | undefined = undefined;
      if (values.bankDetails.isIban) {
        ibanTransferDetails = {
          iban: values.bankDetails.iban || "",
          bic: values.bankDetails.bic,
        };
      } else {
        swiftTransferDetails = {
          account_number: values.bankDetails.account_number || "",
          swift_or_bic: values.bankDetails.bic || "",
        };
      }

      const fiatLoanDetails = await encryptFiatLoanDetailsLender(
        {
          address: values.beneficiaryDetails.address,
          city: values.beneficiaryDetails.city,
          comments: values.beneficiaryDetails.additionalComments,
          country: values.beneficiaryDetails.country,
          full_name: values.beneficiaryDetails.fullName,
          post_code: values.beneficiaryDetails.zipCode,
          bank_address: values.bankDetails.bankAddress,
          bank_country: values.bankDetails.bankCountry,
          bank_name: values.bankDetails.bankName,
          iban_transfer_details: ibanTransferDetails,
          swift_transfer_details: swiftTransferDetails,
          purpose_of_remittance: values.bankDetails.purpose,
        },
        lenderPk,
        borrowerPk,
      );
      onComplete(fiatLoanDetails);
      setOpen(false);
    } catch (error) {
      console.log(`Failed encrypting fiat details ${error}`);
      toast.error("Failed encrypting fiat details");
      setApproveError(
        error instanceof Error
          ? error.message
          : "Failed to encrypt fiat details. Please try again.",
      );
      return;
    } finally {
      setIsAccepting(false);
    }
  }

  const nextStep = async () => {
    if (step === "bank") {
      const bankValid = await form.trigger("bankDetails", {
        shouldFocus: true,
      });
      if (bankValid) {
        setStep("beneficiary");
        setExpandedItems(["beneficiary-details"]);
      }
    } else if (step === "beneficiary") {
      const beneficiaryValid = await form.trigger("beneficiaryDetails", {
        shouldFocus: true,
      });
      if (beneficiaryValid) {
        setStep("review");
        setExpandedItems([]);
      }
    } else if (step === "review") {
      setExpandedItems([]);
    }
  };

  const prevStep = () => {
    if (step === "beneficiary") {
      setStep("bank");
      setExpandedItems(["bank-details"]);
    } else if (step === "review") {
      setStep("beneficiary");
      setExpandedItems(["beneficiary-details"]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="py-4">
              <Card className={"mt-4"}>
                <CardHeader>
                  <CardTitle>Fiat Transfer Details</CardTitle>
                  <CardDescription>
                    Please provide the necessary details for your fiat transfer
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <Accordion
                        type="multiple"
                        value={expandedItems}
                        onValueChange={setExpandedItems}
                        className="w-full"
                      >
                        {/* Bank Details Section */}
                        <AccordionItem value="bank-details">
                          <AccordionTrigger className="text-lg font-medium">
                            Bank Details
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <FormField
                              control={form.control}
                              name="bankDetails.isIban"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      IBAN or SWIFT
                                    </FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {form.watch("bankDetails.isIban") ? (
                              <div
                                className={
                                  "flex flex-row items-center justify-between"
                                }
                              >
                                <FormField
                                  control={form.control}
                                  name="bankDetails.iban"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>IBAN</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Enter IBAN"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="bankDetails.bic"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>BIC</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Enter BIC"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            ) : (
                              <div
                                className={
                                  "flex flex-row items-center justify-between"
                                }
                              >
                                <FormField
                                  control={form.control}
                                  name="bankDetails.account_number"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Account Number</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Enter Account Number"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="bankDetails.swift"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>SWIFT Code</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Enter SWIFT Code"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            <div
                              className={
                                "flex flex-row items-center justify-between"
                              }
                            >
                              <FormField
                                control={form.control}
                                name="bankDetails.bankName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Bank Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter Bank Name"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="bankDetails.bankCountry"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Bank Country</FormLabel>
                                    <FormControl>
                                      <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select Country" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {countries.map((country) => (
                                            <SelectItem
                                              key={country}
                                              value={country}
                                            >
                                              {country}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name="bankDetails.bankAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bank Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter Bank Address"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="bankDetails.purpose"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Purpose of Transfer</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Enter the purpose of this transfer"
                                      {...field}
                                      className="resize-none"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <CardFooter className="flex justify-between px-0">
                              {step !== "bank" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={prevStep}
                                >
                                  Previous
                                </Button>
                              )}

                              <Button
                                type="button"
                                onClick={nextStep}
                                className="ml-auto"
                              >
                                Next
                              </Button>
                            </CardFooter>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Beneficiary Details Section */}
                        <AccordionItem value="beneficiary-details">
                          <AccordionTrigger className="text-lg font-medium">
                            Beneficiary Details
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <FormField
                              control={form.control}
                              name="beneficiaryDetails.fullName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter Full Name"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="beneficiaryDetails.address"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter Address"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="beneficiaryDetails.city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>City</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter City"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="beneficiaryDetails.zipCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Zip Code</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter Zip Code"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name="beneficiaryDetails.country"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Country</FormLabel>
                                  <FormControl>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select Country" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {countries.map((country) => (
                                          <SelectItem
                                            key={country}
                                            value={country}
                                          >
                                            {country}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="beneficiaryDetails.additionalComments"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Additional Comments</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Any additional information"
                                      {...field}
                                      className="resize-none"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <CardFooter className="flex justify-between px-0">
                              {step !== "bank" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={prevStep}
                                >
                                  Previous
                                </Button>
                              )}

                              <Button
                                type="button"
                                onClick={nextStep}
                                className="ml-auto"
                              >
                                Done
                              </Button>
                            </CardFooter>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Alert variant="default" className={"mt-4"}>
                <InfoCircledIcon className="h-4 w-4" />
                <AlertTitle>Info</AlertTitle>
                <AlertDescription>
                  Your banking details are encrypted and will be securely
                  stored.
                </AlertDescription>
              </Alert>

              {approveError && (
                <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md">
                  <p className="text-sm">{approveError}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex sm:justify-between gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Back
              </Button>
              <Button variant="default" type="submit" disabled={isAccepting}>
                {isAccepting ? "Processing..." : <>Submit</>}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFiatDetailsDialog;
