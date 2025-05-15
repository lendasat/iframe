import { ReactNode, useState } from "react";
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
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
  AccordionItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  CardFooter,
  RadioGroup,
  RadioGroupItem,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogTrigger,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import countries from "i18n-iso-countries";
import english from "i18n-iso-countries/langs/en.json";

import {
  IbanTransferDetails,
  InnerFiatLoanDetails as ReactInnerFiatLoanDetails,
  SwiftTransferDetails,
} from "@frontend/base-http-client";
import CountrySelector from "./country-selector";

// Define the zod schema
const bankDetailsSchema = z.object({
  transferType: z.enum(["iban", "swift"]),
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

interface AddFiatDetailsDialogProps {
  children: ReactNode;
  onComplete: (data: ReactInnerFiatLoanDetails) => void;
}

const AddFiatDetailsDialog = ({
  children,
  onComplete,
}: AddFiatDetailsDialogProps) => {
  countries.registerLocale(english);
  const countryCodes = Object.keys(countries.getAlpha2Codes());

  const [open, setOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [approveError, setApproveError] = useState<string | undefined>();
  // const { countries } = useCountries()

  const [step, setStep] = useState<"bank" | "beneficiary" | "review">("bank");
  const [expandedItems, setExpandedItems] = useState<string[]>([
    "bank-details",
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bankDetails: {
        transferType: "iban",
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
    setApproveError(undefined);
    setIsAccepting(true);

    try {
      let ibanTransferDetails: IbanTransferDetails | undefined = undefined;
      let swiftTransferDetails: SwiftTransferDetails | undefined = undefined;
      if (values.bankDetails.transferType === "iban") {
        ibanTransferDetails = {
          iban: values.bankDetails.iban || "",
          bic: values.bankDetails.bic,
        };
      } else {
        swiftTransferDetails = {
          account_number: values.bankDetails.account_number || "",
          swift_or_bic: values.bankDetails.swift || "",
        };
      }

      onComplete({
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
      });
      setOpen(false);
    } catch (error) {
      console.log(`Failed encrypting fiat details ${error}`);
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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fiat Transfer Details</DialogTitle>
          <DialogDescription>
            Please provide the necessary details for your fiat transfer Your
            details are encrypted and will be securely stored.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="py-4">
              <Card className={"mt-0"}>
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
                              name="bankDetails.transferType"
                              render={({ field }) => (
                                <FormItem className="space-y-3">
                                  <FormLabel className="text-base">
                                    Transfer Type
                                  </FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="flex flex-row space-x-4"
                                    >
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="iban" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          IBAN
                                        </FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="swift" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          SWIFT
                                        </FormLabel>
                                      </FormItem>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {form.watch("bankDetails.transferType") ===
                            "iban" ? (
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
                                      <CountrySelector
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select Country"
                                        triggerClassName="w-[150px]"
                                        useCountryNameAsValue={true}
                                      />
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
                                    <CountrySelector
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="Select Country"
                                      triggerClassName="w-[150px]"
                                      useCountryNameAsValue={true}
                                    />
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

              {approveError && (
                <div className="mt-4 p-2 bg-red-50 text-red-600 rounded-md">
                  <p className="text-sm">{approveError}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex sm:justify-between gap-2">
              <Button
                variant="outline"
                type={"button"}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
              >
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
