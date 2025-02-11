import { Box, Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";

interface ContractRequestedProps {
  isLoading: boolean;
  onContractApprove: () => Promise<void>;
  onContractReject: () => Promise<void>;
}

export const ContractRequested = ({
  isLoading,
  onContractApprove,
  onContractReject,
}: ContractRequestedProps) => {
  return (
    <Box className="flex flex-col space-y-4">
      <Heading
        className={"text-font dark:text-font-dark"}
        weight={"medium"}
        size={"4"}
      >
        Awaiting Your Remark
      </Heading>
      <Text
        className={"mb-3 text-font dark:text-font-dark"}
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
              disabled={isLoading}
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
                  onClick={onContractApprove}
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
    </Box>
  );
};
