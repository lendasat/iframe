import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import {
  Box,
  Button,
  Callout,
  Dialog,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { PiWarningCircle } from "react-icons/pi";
import { useNavigate } from "react-router-dom";

interface ContractPendingKycProps {
  contractId: string;
  kycLink: string;
  isKycDone: boolean;
}

export function ContractPendingKyc({
  contractId,
  kycLink,
  isKycDone,
}: ContractPendingKycProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { cancelContractRequest } = useBorrowerHttpClient();
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onCancelConfirm = async () => {
    try {
      setIsLoading(true);
      setError("");
      await cancelContractRequest(contractId);
      navigate(0);
    } catch (error) {
      setError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box className="flex flex-col space-y-4">
      <Heading
        className={"text-font dark:text-font-dark"}
        weight={"medium"}
        size={"5"}
      >
        Waiting for KYC process
      </Heading>
      <Text
        className={"mb-3 text-font dark:text-font-dark"}
        weight={"medium"}
        size={"3"}
      >
        You must complete the KYC process before the lender can accept your
        contract request.
      </Text>
      <Text
        className={"mb-3 text-font dark:text-font-dark"}
        weight={"medium"}
        size={"3"}
      >
        Follow this{" "}
        <a
          className="text-blue-500 hover:underline"
          target={"_blank"}
          rel="noreferrer"
          href={kycLink}
        >
          link
        </a>{" "}
        to start the KYC process.
      </Text>
      <Text
        className={"mb-3 text-font dark:text-font-dark"}
        weight={"medium"}
        size={"3"}
      >
        The status of the KYC process is{" "}
        <strong>
          <em>
            {isKycDone ? (
              <Text className="text-green-500">DONE</Text>
            ) : (
              <Text className="text-gray-500">PENDING</Text>
            )}
          </em>
        </strong>
        .{isKycDone && " The lender should accept your contract request soon!"}
      </Text>
      <Dialog.Root>
        <Dialog.Trigger>
          <Button color="red" size={"3"}>
            Cancel Request
          </Button>
        </Dialog.Trigger>
        <Dialog.Content className={"bg-light dark:bg-dark"} maxWidth="450px">
          <Dialog.Title className={"text-font dark:text-font-dark"}>
            Cancel Request
          </Dialog.Title>
          <Dialog.Description
            size="2"
            mb="4"
            className={"text-font dark:text-font-dark"}
          >
            Are you sure you want to cancel this loan request?
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Back
              </Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button
                color="green"
                onClick={onCancelConfirm}
                loading={isLoading}
                disabled={isLoading}
              >
                Cancel Request
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      {error && (
        <Callout.Root color="red">
          <Callout.Icon>
            <PiWarningCircle />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
}
