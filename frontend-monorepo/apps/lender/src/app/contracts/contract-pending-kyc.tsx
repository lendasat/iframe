import { Box, Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";

interface ContractPendingKycProps {
  isLoading: boolean;
  onKycApprove: () => Promise<void>;
  onKycReject: () => Promise<void>;
  kycLink: string;
}

export const ContractPendingKyc = ({
  isLoading,
  onKycApprove,
  onKycReject,
  kycLink,
}: ContractPendingKycProps) => {
  return (
    <Box className="flex flex-col space-y-4">
      <Heading className={"text-font dark:text-font-dark"} weight={"medium"} size={"5"}>
        Awaiting KYC Outcome
      </Heading>
      <Text className={"mb-3 text-font dark:text-font-dark"} weight={"medium"} size={"3"}>
        We have sent your KYC <a className="text-blue-500 hover:underline" href={kycLink}>link</a> to the borrower.
      </Text>
      <Text className={"mb-3 text-font dark:text-font-dark"} weight={"medium"} size={"3"}>
        Once the borrower has passed the KYC process, hit <em className="text-green-500">approve</em>{" "}
        to move forward with the contract.
      </Text>
      <Text className={"mb-3 text-font dark:text-font-dark"} weight={"medium"} size={"3"}>
        If the borrower was unsuccessful, hit <em className="text-red-500">reject</em>.
      </Text>
      <Box className="flex flex-row space-x-2">
        <Dialog.Root>
          <Dialog.Trigger>
            <Button
              className="flex-1"
              color="green"
              loading={isLoading}
              disabled={isLoading}
              size={"3"}
            >
              Approve
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px" className={"bg-light dark:bg-dark"}>
            <Dialog.Title className={"text-font dark:text-font-dark"}>Approve KYC Process</Dialog.Title>
            <Dialog.Description size="2" mb="4" className={"text-font dark:text-font-dark"}>
              Do you want to mark the KYC process as successful?
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
                  onClick={onKycApprove}
                >
                  Yes
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
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
            <Dialog.Title className={"text-font dark:text-font-dark"}>Reject KYC Process</Dialog.Title>
            <Dialog.Description size="2" mb="4" className={"text-font dark:text-font-dark"}>
              Do you want to mark the KYC process as failed?
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
                onClick={onKycReject}
              >
                Yes
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Box>
    </Box>
  );
};
