import {
  Box,
  Button,
  Callout,
  DataList,
  Dialog,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import {
  FiatDialogFormDetails,
  FiatTransferDetails,
  FiatTransferDetailsDialog,
  LoanAsset,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { FiatLoanDetails } from "@frontend/base-http-client";
import { IoInformationCircleOutline } from "react-icons/io5";

interface ContractRequestedProps {
  isLoading: boolean;
  onContractApprove: (fiatTransferDetails?: FiatLoanDetails) => Promise<void>;
  onContractReject: () => Promise<void>;
  loanAsset: LoanAsset;
  borrowerPk: string;
  lenderPk: string;
}

export const ContractRequested = ({
  isLoading,
  onContractApprove,
  onContractReject,
  loanAsset,
  borrowerPk,
  lenderPk,
}: ContractRequestedProps) => {
  const [error, setError] = useState("");

  const [fiatTransferDetailsConfirmed, setFiatTransferDetailsConfirmed] =
    useState(false);
  const [encryptedFiatTransferDetails, setEncryptedFiatTransferDetails] =
    useState<FiatLoanDetails | undefined>();
  const [fiatTransferDetails, setFiatTransferDetails] =
    useState<FiatDialogFormDetails>({
      bankDetails: {
        isIban: true,
        iban: "",
        bic: "",
        account_number: "",
        swift: "",
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
    });

  const approveContract = async () => {
    if (LoanAssetHelper.isFiat(loanAsset)) {
      if (!encryptedFiatTransferDetails) {
        setError("Banking details are required");
        return;
      }
    }
    await onContractApprove(encryptedFiatTransferDetails);
  };

  return (
    <Box className="flex flex-col space-y-4">
      <Heading
        className={"text-font dark:text-font-dark"}
        weight={"medium"}
        size={"4"}
      >
        Awaiting Your Remark
      </Heading>

      {LoanAssetHelper.isFiat(loanAsset) && (
        <Box>
          <DataList.Root orientation={"vertical"}>
            <DataList.Item>
              <DataList.Label minWidth="88px">Repayment details</DataList.Label>
              <DataList.Value>
                {fiatTransferDetailsConfirmed ? (
                  <FiatTransferDetails
                    details={fiatTransferDetails}
                    onConfirm={async (
                      encryptFn?: (
                        ownEncryptionPk: string,
                      ) => Promise<FiatLoanDetails>,
                    ) => {
                      if (encryptFn) {
                        const details = await encryptFn(lenderPk);

                        setEncryptedFiatTransferDetails(details);
                      }
                    }}
                    isBorrower={false}
                    counterpartyPk={borrowerPk}
                  />
                ) : (
                  <FiatTransferDetailsDialog
                    formData={fiatTransferDetails}
                    onConfirm={(data: FiatDialogFormDetails) => {
                      setFiatTransferDetails(data);
                      setFiatTransferDetailsConfirmed(true);
                    }}
                  >
                    <Box width="100%">
                      <Button size="2" style={{ width: "100%" }}>
                        Add loan transfer details
                      </Button>
                    </Box>
                  </FiatTransferDetailsDialog>
                )}
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {/* Error message */}
          {error && (
            <Callout.Root color="tomato" mt={"3"}>
              <Callout.Icon>
                <IoInformationCircleOutline />
              </Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}
        </Box>
      )}
      <Text
        className={"text-font dark:text-font-dark mb-3"}
        weight={"medium"}
        size={"3"}
      >
        Do you want to go ahead with this request?
      </Text>
      <Box className="flex flex-row space-x-2">
        {/* Approve Button */}
        <Dialog.Root>
          <Dialog.Trigger>
            <Button
              className="flex-1"
              color="green"
              loading={isLoading}
              disabled={
                isLoading ||
                (LoanAssetHelper.isFiat(loanAsset) &&
                  !encryptedFiatTransferDetails)
              }
              size={"3"}
            >
              Approve
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px" className={"bg-light dark:bg-dark"}>
            <Dialog.Title className={"text-font dark:text-font-dark"}>
              Approval Contract
            </Dialog.Title>
            <Dialog.Description
              size="2"
              mb="4"
              className={"text-font dark:text-font-dark"}
            >
              Are you sure you want to approve this loan?
            </Dialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Dialog.Close>
                <Button
                  color="green"
                  loading={isLoading}
                  disabled={isLoading}
                  onClick={approveContract}
                >
                  Approve
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
        {/* Reject Button */}
        <Dialog.Root>
          <Dialog.Trigger>
            <Button
              className="flex-1"
              color="red"
              loading={isLoading}
              disabled={isLoading}
              size={"3"}
            >
              Reject
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px" className={"bg-light dark:bg-dark"}>
            <Dialog.Title className={"text-font dark:text-font-dark"}>
              Reject Contract
            </Dialog.Title>
            <Dialog.Description
              size="2"
              mb="4"
              className={"text-font dark:text-font-dark"}
            >
              Are you sure you want to reject this loan?
            </Dialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                color="red"
                loading={isLoading}
                disabled={isLoading}
                onClick={onContractReject}
              >
                Reject
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Box>
      {LoanAssetHelper.isFiat(loanAsset) && !fiatTransferDetailsConfirmed && (
        <Callout.Root color="orange" mt={"4"} mb={"4"}>
          <Callout.Icon>
            <IoInformationCircleOutline />
          </Callout.Icon>
          <Callout.Text>Please provide banking details</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
};
