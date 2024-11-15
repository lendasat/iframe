import type { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { AlertDialog, Box, Button, Checkbox, Flex, Separator, Text } from "@radix-ui/themes";
import { useState } from "react";
import { Link } from "react-router-dom";

interface PayWithMoonDescriptionDialogProps {
  option: LoanProductOption;
  selectedOption: LoanProductOption | undefined;
  onSelect: (option: LoanProductOption | undefined) => void;
}

export const PayWithMoonDescriptionDialog = ({
  option,
  selectedOption,
  onSelect,
}: PayWithMoonDescriptionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isAccepted, setIsAccepted] = useState(selectedOption === option);

  const isSelected = selectedOption === option;
  const onOpening = () => {
    setOpen(true);
  };

  const onDeclining = () => {
    setIsAccepted(false);
    onSelect(undefined);
    setOpen(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger>
        <Button
          variant="soft"
          size={"3"}
          color={isSelected ? "purple" : "gray"}
          className="w-1/3"
          onClick={() => onOpening()}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px" className="rounded-lg">
        <Box className="py-4 text-center max-w-sm mx-auto">
          <Flex align={"center"} justify={"center"} gap={"3"} pb={"1"}>
            <Separator size={"3"} className="bg-font/30" />
            <AlertDialog.Title className="shrink-0 p-0 m-0">Receive a debit card (TODO)</AlertDialog.Title>
            <Separator size={"3"} className="bg-font/30" />
          </Flex>
        </Box>
        <Box className="relative bg-slate-50 py-3">
          <Box className="max-h-72 overflow-y-scroll px-4 custom-scrollbar">
            <AlertDialog.Description size="2" className="text-pretty leading-[1.8] text-font/60">
              <Text size={"2"} className="text-font">
                TODO
              </Text>
            </AlertDialog.Description>
          </Box>
          <div className="absolute bottom-0 h-7 bg-gradient-to-t from-white via-white/70 to-white/0 z-10 w-full left-0" />
        </Box>
        <Box py={"3"} className="px-4">
          <Text as="label" size="2" weight={"medium"}>
            <Flex gap="2">
              <Checkbox
                color="purple"
                variant="soft"
                checked={isAccepted}
                onCheckedChange={() => {
                  setIsAccepted(!isAccepted);
                }}
              />
              <>
                Accept{" "}
                <Link
                  to="https://lendasat.notion.site/Terms-of-Service-100d2f24d4cf801aa6cee15f1b77e11b?pvs=25"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms and Conditions
                </Link>
              </>
            </Flex>
          </Text>
        </Box>
        <Flex gap="3" mt="4" justify="center" align={"center"}>
          <AlertDialog.Cancel className="grow">
            <Button variant="outline" size={"3"} className="text-sm" color="gray" onClick={() => onDeclining()}>
              Decline
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action className="grow">
            <Button
              disabled={!isAccepted}
              variant="solid"
              size={"3"}
              color="purple"
              className="text-sm"
              onClick={() => onSelect(option)}
            >
              Continue
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};
