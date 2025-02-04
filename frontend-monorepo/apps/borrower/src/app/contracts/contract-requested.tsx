import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Button, Callout, Dialog, Flex, Heading, Text, Tooltip } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { LuClock1 } from "react-icons/lu";
import { PiWarningCircle, PiWarningCircleBold } from "react-icons/pi";
import { useNavigate } from "react-router-dom";

interface ContractRequestedProps {
  createdAt: Date;
  contractId: string;
}

export function ContractRequested({ createdAt, contractId }: ContractRequestedProps) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { cancelContractRequest } = useBorrowerHttpClient();
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const expiryTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // createdAt + 24 hours
      const diff = expiryTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${
            seconds.toString().padStart(2, "0")
          }`,
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt]);

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
    <Box>
      <Heading className={"text-font dark:text-font-dark"} weight={"medium"} size={"4"}>
        Awaiting Lenders Remark...
      </Heading>
      <Box className="mt-3 h-12 px-2 justify-between rounded-xl bg-gradient-to-r from-pink-500/20 to-active-nav/50 to-90% flex items-center">
        <Flex align={"center"} gap={"2"}>
          <Box className="h-8 w-8 bg-black rounded-lg flex items-center justify-center">
            <LuClock1 color="white" size={17} />
          </Box>
          <Text className={"text-font dark:text-font-dark"} weight={"medium"} size={"2"}>
            Time Remaining
          </Text>
        </Flex>
        <Flex align={"center"} gap={"2"}>
          <Heading size={"3"} className={"text-font dark:text-font-dark"}>
            {timeRemaining}
          </Heading>
          <Tooltip content={"Waiting for the lenders response"}>
            <PiWarningCircleBold className={"text-font dark:text-font-dark"} />
          </Tooltip>
        </Flex>
      </Box>
      <Dialog.Root>
        <Dialog.Trigger>
          <Button
            color="red"
            size={"3"}
          >
            Cancel Request
          </Button>
        </Dialog.Trigger>
        <Dialog.Content className={"bg-light dark:bg-dark"} maxWidth="450px">
          <Dialog.Title className={"text-font dark:text-font-dark"}>Cancel Request</Dialog.Title>
          <Dialog.Description size="2" mb="4" className={"text-font dark:text-font-dark"}>
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
          <Callout.Text>
            {error}
          </Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
}
