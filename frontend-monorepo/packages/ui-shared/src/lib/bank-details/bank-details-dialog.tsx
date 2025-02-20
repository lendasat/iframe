import * as Form from "@radix-ui/react-form";
import {
  Box,
  Button,
  Callout,
  DataList,
  Dialog,
  Flex,
  Heading,
  RadioGroup,
  Separator,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { FormEvent, ReactNode, useState } from "react";
import { LuPencil } from "react-icons/lu";
import { UnlockWalletModal, useWallet } from "@lendasat/browser-wallet";
import {
  FiatLoanDetails,
  IbanTransferDetails,
  SwiftTransferDetails,
} from "@lendasat/base-http-client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";

export interface FiatDialogFormDetails {
  bankDetails: BankDetails;
  beneficiaryDetails: BeneficiaryDetails;
}

interface BankDetails {
  isIban: boolean;
  iban: string;
  bic: string;
  account_number: string;
  swift: string;
  bankName: string;
  bankAddress: string;
  bankCountry: string;
  purpose: string;
}

interface BeneficiaryDetails {
  fullName: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  additionalComments: string;
}

interface FormFieldProps {
  fieldName: string;
  label: string;
  errorIfMissing: string;
  errorIfMismatch: string;
  value: string;
  onChange: (value: string) => void;
  inputType?: FormFieldInputType;
}

enum FormFieldInputType {
  TextField,
  TextArea,
}

function FormField({
  label,
  errorIfMissing,
  errorIfMismatch,
  fieldName,
  value,
  onChange,
  inputType: maybeInputType,
}: FormFieldProps) {
  const inputType = maybeInputType || FormFieldInputType.TextField;

  return (
    <Form.Field className="mb-2.5 grid" name={fieldName}>
      <Flex className="items-baseline justify-between">
        <Form.Label>
          <Text weight="medium" size="2">
            {label}
          </Text>
        </Form.Label>
        <Form.Message match="valueMissing">
          <Text weight="light" size="1" className="opacity-80">
            {errorIfMissing}
          </Text>
        </Form.Message>
        <Form.Message className="text-sm opacity-80" match="typeMismatch">
          {errorIfMismatch}
        </Form.Message>
      </Flex>
      <Form.Control asChild>
        <>
          {inputType === FormFieldInputType.TextField && (
            <TextField.Root
              required={true}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          {inputType === FormFieldInputType.TextArea && (
            <TextArea
              required={true}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </>
      </Form.Control>
    </Form.Field>
  );
}

function FiatDetailsSummary(props: { localFormData: FiatDialogFormDetails }) {
  return (
    <>
      <Heading size="2" weight="bold" mt="3" mb={"2"}>
        Bank Details
      </Heading>
      <DataList.Root>
        {props.localFormData.bankDetails.isIban && (
          <>
            <DataList.Item align="center">
              <DataList.Label minWidth="88px">IBAN</DataList.Label>
              <DataList.Value>
                <Text size="2">{props.localFormData.bankDetails.iban}</Text>
              </DataList.Value>
            </DataList.Item>

            <DataList.Item align="center">
              <DataList.Label minWidth="88px">BIC</DataList.Label>
              <DataList.Value>
                <Text size="2">{props.localFormData.bankDetails.bic}</Text>
              </DataList.Value>
            </DataList.Item>
          </>
        )}
        {!props.localFormData.bankDetails.isIban && (
          <>
            <DataList.Item align="center">
              <DataList.Label minWidth="88px">Account Number</DataList.Label>
              <DataList.Value>
                <Text size="2">
                  {props.localFormData.bankDetails.account_number}
                </Text>
              </DataList.Value>
            </DataList.Item>

            <DataList.Item align="center">
              <DataList.Label minWidth="88px">SWIFT</DataList.Label>
              <DataList.Value>
                <Text size="2">{props.localFormData.bankDetails.swift}</Text>
              </DataList.Value>
            </DataList.Item>
          </>
        )}

        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Bank Name</DataList.Label>
          <DataList.Value>
            <Text size="2">{props.localFormData.bankDetails.bankName}</Text>
          </DataList.Value>
        </DataList.Item>

        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Bank Address</DataList.Label>
          <DataList.Value>
            <Text size="2">
              {props.localFormData.bankDetails.bankAddress},{" "}
              {props.localFormData.bankDetails.bankCountry}
            </Text>
          </DataList.Value>
        </DataList.Item>

        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Payment purpose</DataList.Label>
          <DataList.Value>
            <Text size="2">{props.localFormData.bankDetails.purpose}</Text>
          </DataList.Value>
        </DataList.Item>
      </DataList.Root>

      <Separator
        orientation="horizontal"
        size={"4"}
        color={"purple"}
        mt={"4"}
      />

      <Heading size="2" weight="bold" mt="3" mb={"2"}>
        Beneficiary Details
      </Heading>

      <DataList.Root>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Full Name</DataList.Label>
          <DataList.Value>
            <Text size="2">
              {props.localFormData.beneficiaryDetails.fullName}
            </Text>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Address</DataList.Label>
          <DataList.Value>
            <Text size="2">
              {props.localFormData.beneficiaryDetails.address},{" "}
              {props.localFormData.beneficiaryDetails.city},{" "}
              {props.localFormData.beneficiaryDetails.zipCode},{" "}
              {props.localFormData.beneficiaryDetails.country}
            </Text>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Additional Comments</DataList.Label>
          <DataList.Value>
            <Text size="2">
              {props.localFormData.beneficiaryDetails.additionalComments}
            </Text>
          </DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </>
  );
}

interface FiatDialogProps {
  formData: FiatDialogFormDetails;
  onConfirm: (details: FiatDialogFormDetails) => void;
  children: ReactNode;
}

export function FiatTransferDetailsDialog({
  formData,
  onConfirm,
  children,
}: FiatDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedTransferType, setSelectedTransferType] = useState("iban");
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const [localFormData, setLocalFormData] =
    useState<FiatDialogFormDetails>(formData);

  const handleBankDetailsChange = (field: keyof BankDetails, value: string) => {
    setLocalFormData((prev) => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [field]: value,
      },
    }));
  };
  const handleBankDetailsChangeBoolean = (
    field: keyof BankDetails,
    value: boolean,
  ) => {
    setLocalFormData((prev) => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [field]: value,
      },
    }));
  };

  const handleBeneficiaryDetailsChange = (
    field: keyof BeneficiaryDetails,
    value: string,
  ) => {
    setLocalFormData((prev) => ({
      ...prev,
      beneficiaryDetails: {
        ...prev.beneficiaryDetails,
        [field]: value,
      },
    }));
  };

  const handleNext = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleConfirm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOpen(false);
    console.log("Where am I?");
    onConfirm(localFormData);
  };

  const BankDetailsStep = () => {
    return (
      <Form.Root onSubmit={handleNext}>
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="4" className="w-full" gridColumn={"2"}>
            <RadioGroup.Root
              value={selectedTransferType}
              name="ibanOrSwift"
              onValueChange={(val) => {
                setSelectedTransferType(val);
                handleBankDetailsChangeBoolean("isIban", val === "iban");
              }}
            >
              <Flex direction="row" gap="4" className="w-full" gridColumn={"2"}>
                <RadioGroup.Item value="iban">IBAN</RadioGroup.Item>
                <RadioGroup.Item value="switft">SWIFT</RadioGroup.Item>
              </Flex>
            </RadioGroup.Root>

            {/* Input Fields */}

            {selectedTransferType === "iban" && (
              <Flex direction="row" gap="2">
                <div className="flex-1">
                  <FormField
                    fieldName="iban"
                    label="IBAN"
                    errorIfMismatch="IBAN is not valid"
                    errorIfMissing="IBAN is required"
                    value={localFormData.bankDetails.iban}
                    onChange={(value) => handleBankDetailsChange("iban", value)}
                  />
                </div>
                <FormField
                  fieldName="bic"
                  label="BIC"
                  errorIfMismatch="BIC is not valid"
                  errorIfMissing="BIC is required"
                  value={localFormData.bankDetails.bic}
                  onChange={(value) => handleBankDetailsChange("bic", value)}
                />
              </Flex>
            )}
            {selectedTransferType !== "iban" && (
              <Flex direction="row" gap="2">
                <div className="flex-1">
                  <FormField
                    fieldName="account_number"
                    label="Account Number"
                    errorIfMismatch="Account number is not valid"
                    errorIfMissing="Account number is required"
                    value={localFormData.bankDetails.account_number}
                    onChange={(value) =>
                      handleBankDetailsChange("account_number", value)
                    }
                  />
                </div>
                <FormField
                  fieldName="swift"
                  label="SWIFT"
                  errorIfMismatch="SWIFT is not valid"
                  errorIfMissing="SWIFT is required"
                  value={localFormData.bankDetails.swift}
                  onChange={(value) => handleBankDetailsChange("swift", value)}
                />
              </Flex>
            )}
          </Flex>
          <FormField
            fieldName="bankName"
            label="Bank Name"
            errorIfMismatch="Bank name is not valid"
            errorIfMissing="Bank name is required"
            value={localFormData.bankDetails.bankName}
            onChange={(value) => handleBankDetailsChange("bankName", value)}
          />
          <FormField
            fieldName="bankAddress"
            label="Bank Address"
            errorIfMismatch="Bank address is not valid"
            errorIfMissing="Bank address is required"
            value={localFormData.bankDetails.bankAddress}
            onChange={(value) => handleBankDetailsChange("bankAddress", value)}
          />
          <FormField
            fieldName="bankCountry"
            label="Bank Country"
            errorIfMismatch="Bank country is not valid"
            errorIfMissing="Bank country is required"
            value={localFormData.bankDetails.bankCountry}
            onChange={(value) => handleBankDetailsChange("bankCountry", value)}
          />
          <FormField
            fieldName="purpose"
            label="Purpose"
            errorIfMismatch="Purpose is not valid"
            errorIfMissing="Purpose is required"
            value={localFormData.bankDetails.purpose}
            onChange={(value) => handleBankDetailsChange("purpose", value)}
            inputType={FormFieldInputType.TextArea}
          />
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Form.Submit asChild>
            <Button>Next</Button>
          </Form.Submit>
        </Flex>
      </Form.Root>
    );
  };

  const renderBeneficiaryDetailsStep = () => (
    <Form.Root onSubmit={handleNext}>
      <Flex direction="column" gap="3">
        <FormField
          fieldName="fullName"
          label="Full Name"
          errorIfMismatch="Full name is not valid"
          errorIfMissing="Full name is required"
          value={localFormData.beneficiaryDetails.fullName}
          onChange={(value) =>
            handleBeneficiaryDetailsChange("fullName", value)
          }
        />
        <FormField
          fieldName="address"
          label="Address"
          errorIfMismatch="Address is not valid"
          errorIfMissing="Address is required"
          value={localFormData.beneficiaryDetails.address}
          onChange={(value) => handleBeneficiaryDetailsChange("address", value)}
        />
        <Flex direction="row" gap="2" className="w-full">
          <div className="flex-1">
            <FormField
              fieldName="city"
              label="City"
              errorIfMismatch="City is not valid"
              errorIfMissing="City is required"
              value={localFormData.beneficiaryDetails.city}
              onChange={(value) =>
                handleBeneficiaryDetailsChange("city", value)
              }
            />
          </div>
          <FormField
            fieldName="zipCode"
            label="ZIP Code"
            errorIfMismatch="ZIP code is not valid"
            errorIfMissing="ZIP code is required"
            value={localFormData.beneficiaryDetails.zipCode}
            onChange={(value) =>
              handleBeneficiaryDetailsChange("zipCode", value)
            }
          />
        </Flex>

        <FormField
          fieldName="country"
          label="Country"
          errorIfMismatch="Country is not valid"
          errorIfMissing="Country is required"
          value={localFormData.beneficiaryDetails.country}
          onChange={(value) => handleBeneficiaryDetailsChange("country", value)}
        />
        <FormField
          fieldName="additionalComments"
          label="Additional Comments"
          errorIfMismatch="Comments are not valid"
          errorIfMissing="Comments are required"
          value={localFormData.beneficiaryDetails.additionalComments}
          onChange={(value) =>
            handleBeneficiaryDetailsChange("additionalComments", value)
          }
          inputType={FormFieldInputType.TextArea}
        />
      </Flex>
      <Flex gap="3" mt="4" justify="end">
        <Button variant="soft" onClick={handleBack}>
          Back
        </Button>
        <Form.Submit asChild>
          <Button>Next</Button>
        </Form.Submit>
      </Flex>
    </Form.Root>
  );

  const renderConfirmationStep = () => (
    <Form.Root onSubmit={handleConfirm}>
      <Flex direction="column" gap="3">
        <Heading size="4" weight="bold">
          Please confirm the details
        </Heading>

        <FiatDetailsSummary localFormData={localFormData} />
      </Flex>
      <Flex gap="3" mt="4" justify="end">
        <Button variant="soft" onClick={handleBack}>
          Back
        </Button>
        <Form.Submit asChild>
          <Button>Confirm</Button>
        </Form.Submit>
      </Flex>
    </Form.Root>
  );

  return (
    <Box>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Trigger>{children}</Dialog.Trigger>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>Loan Transfer Details</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Please provide the necessary transfer details
          </Dialog.Description>

          {step === 1 && BankDetailsStep()}
          {step === 2 && renderBeneficiaryDetailsStep()}
          {step === 3 && renderConfirmationStep()}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

interface FiatTransferDetailsProps {
  details: FiatDialogFormDetails;
  onConfirm: (details?: FiatLoanDetails) => void;
  isBorrower: boolean;
  counterpartyXpub: string;
}

export const FiatTransferDetails = ({
  details,
  onConfirm,
  isBorrower,
  counterpartyXpub,
}: FiatTransferDetailsProps) => {
  const [fiatTransferDetails, setFiatTransferDetails] =
    useState<FiatDialogFormDetails>(details);
  const [dataEncrypted, setDataEncrypted] = useState(false);
  const [error, setError] = useState("");

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };
  const [isLoading, setIsLoading] = useState(false);
  const {
    encryptFiatLoanDetailsBorrower,
    encryptFiatLoanDetailsLender,
    isWalletLoaded,
  } = useWallet();

  const unlockWalletOrEncrypt = async () => {
    if (!isWalletLoaded) {
      setIsLoading(true);
      handleOpenUnlockWalletModal();
      setIsLoading(false);
      return;
    }

    if (!fiatTransferDetails) {
      setError("No details provided");
      return;
    }

    let ibanTransferDetails: IbanTransferDetails | undefined = undefined;
    let swiftTransferDetails: SwiftTransferDetails | undefined = undefined;

    if (fiatTransferDetails.bankDetails.isIban) {
      ibanTransferDetails = {
        iban: fiatTransferDetails.bankDetails.iban,
        bic: fiatTransferDetails.bankDetails.bic,
      };
    } else {
      swiftTransferDetails = {
        swift_or_bic: fiatTransferDetails.bankDetails.swift,
        account_number: fiatTransferDetails.bankDetails.bic,
      };
    }

    try {
      if (isBorrower) {
        const fiatDetails = await encryptFiatLoanDetailsBorrower(
          {
            iban_transfer_details: ibanTransferDetails,
            swift_transfer_details: swiftTransferDetails,
            bank_address: fiatTransferDetails.bankDetails.bankAddress,
            bank_country: fiatTransferDetails.bankDetails.bankCountry,
            bank_name: fiatTransferDetails.bankDetails.bankName,
            purpose_of_remittance: fiatTransferDetails.bankDetails.purpose,
            // personal fiatTransferDetails
            address: fiatTransferDetails.beneficiaryDetails.address,
            city: fiatTransferDetails.beneficiaryDetails.city,
            comments: fiatTransferDetails.beneficiaryDetails.additionalComments,
            country: fiatTransferDetails.beneficiaryDetails.country,
            full_name: fiatTransferDetails.beneficiaryDetails.fullName,
            post_code: fiatTransferDetails.beneficiaryDetails.zipCode,
          },
          counterpartyXpub,
        );
        onConfirm(fiatDetails);
      } else {
        const fiatDetails = await encryptFiatLoanDetailsLender(
          {
            iban_transfer_details: ibanTransferDetails,
            swift_transfer_details: swiftTransferDetails,
            bank_address: fiatTransferDetails.bankDetails.bankAddress,
            bank_country: fiatTransferDetails.bankDetails.bankCountry,
            bank_name: fiatTransferDetails.bankDetails.bankName,
            purpose_of_remittance: fiatTransferDetails.bankDetails.purpose,
            // personal fiatTransferDetails
            address: fiatTransferDetails.beneficiaryDetails.address,
            city: fiatTransferDetails.beneficiaryDetails.city,
            comments: fiatTransferDetails.beneficiaryDetails.additionalComments,
            country: fiatTransferDetails.beneficiaryDetails.country,
            full_name: fiatTransferDetails.beneficiaryDetails.fullName,
            post_code: fiatTransferDetails.beneficiaryDetails.zipCode,
          },
          counterpartyXpub,
        );
        onConfirm(fiatDetails);
      }
      setDataEncrypted(true);
    } catch (error) {
      console.log(`Failed encrypting fiat loan details ${error}`);
      setError(`Failed encrypting fiat loan details ${error}`);
      return;
    }
  };

  return (
    <Box className={"w-full"}>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      {!dataEncrypted && (
        <Callout.Root color={"amber"} className="w-full">
          <Callout.Icon>
            <FontAwesomeIcon icon={faCheckCircle} />
          </Callout.Icon>

          <Callout.Text>
            <Flex direction={"row"} gap={"3"} align={"center"}>
              <Text>Please encrypt details</Text>
              <FiatTransferDetailsDialog
                formData={fiatTransferDetails}
                onConfirm={(data) => {
                  setDataEncrypted(false);
                  setFiatTransferDetails(data);
                  onConfirm(undefined);
                }}
              >
                <Button variant="soft" color={"purple"}>
                  <LuPencil size={16} />
                </Button>
              </FiatTransferDetailsDialog>
            </Flex>
            <Button
              loading={isLoading}
              onClick={unlockWalletOrEncrypt}
              mt={"3"}
              color={"purple"}
              disabled={dataEncrypted}
            >
              {isWalletLoaded ? "Encrypt Details" : "Unlock to Encrypt"}
            </Button>
          </Callout.Text>
        </Callout.Root>
      )}
      {dataEncrypted && (
        <Callout.Root color={"green"} className="w-full">
          <Callout.Icon>
            <FontAwesomeIcon icon={faCheckCircle} />
          </Callout.Icon>

          <Callout.Text>
            <Flex direction={"row"} gap={"3"} align={"center"}>
              <Text>Payment details provided</Text>
              <FiatTransferDetailsDialog
                formData={fiatTransferDetails}
                onConfirm={(data) => {
                  setDataEncrypted(false);
                  setFiatTransferDetails(data);
                  onConfirm(undefined);
                }}
              >
                <Button variant="soft" color={"purple"}>
                  <LuPencil size={16} />
                </Button>
              </FiatTransferDetailsDialog>
            </Flex>
            <Button
              loading={isLoading}
              onClick={unlockWalletOrEncrypt}
              mt={"3"}
              color={"purple"}
              disabled={dataEncrypted}
            >
              {"Details encrypted"}
            </Button>
          </Callout.Text>
        </Callout.Root>
      )}

      {error && (
        <Callout.Root color={"red"} className="w-full">
          <Callout.Icon>
            <FontAwesomeIcon icon={faCheckCircle} />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
};
