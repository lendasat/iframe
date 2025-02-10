import type { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { AlertDialog, Box, Button, Callout, Checkbox, Flex, Separator, Text } from "@radix-ui/themes";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { Link } from "react-router-dom";

interface StableCoinDescriptionDialogProps {
  option?: LoanProductOption;
  selectedOption: LoanProductOption | undefined;
  onSelect: (option: LoanProductOption | undefined) => void;
  disabled: boolean;
}

export const StableCoinDescriptionDialog = ({
  option,
  selectedOption,
  onSelect,
  disabled,
}: StableCoinDescriptionDialogProps) => {
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
          className={`w-full ${
            isSelected ? "text-purple-500 dark:text-purple-300" : "text-gray-500 dark:text-gray-300"
          }`}
          disabled={disabled}
          onClick={() => onOpening()}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="550px" className="rounded-lg bg-white dark:bg-dark">
        <Box className="py-4 text-center max-w-sm mx-auto">
          <Flex align={"center"} justify={"center"} gap={"3"} pb={"1"}>
            <Separator size={"3"} className="bg-font/30 dark:bg-font-dark/30" />
            <AlertDialog.Title className="text-font dark:text-font-dark shrink-0 p-0 m-0">
              Receive stablecoins
            </AlertDialog.Title>
            <Separator size={"3"} className="bg-font/30 dark:bg-font-dark/30" />
          </Flex>
        </Box>
        <Box className="relative bg-slate-50 py-3 dark:bg-slate-800">
          <Box className="max-h-72 overflow-y-scroll px-4 custom-scrollbar">
            <AlertDialog.Description size="2" className="text-pretty leading-[1.8] text-font/60 dark:text-font/60">
              <Text size={"2"} className="text-font dark:text-font-dark">
                By picking this option, you will receive the loan amount as stablecoins to the address you selected. You
                may receive your loan as stablecoins on various different chains including (but not limited to):
                <ul className="list-disc ml-6">
                  {StableCoinHelper.all().map((item, index) => <li key={index}>{StableCoinHelper.print(item)}</li>)}
                </ul>
                This gives you maximum flexibility, e.g. you can transfer the coins to a preferred exchange, buy more
                Bitcoin on a DEX or use the coins in any Defi application.
              </Text>
            </AlertDialog.Description>
          </Box>
          <div className="absolute bottom-0 h-7 bg-gradient-to-t from-white via-white/70 to-white/0 z-10 w-full left-0 dark:from-dark dark:via-dark/70 dark:to-dark/0" />
          <Callout.Root color="teal" variant="soft" highContrast>
            <Callout.Icon>
              <FaInfoCircle />
            </Callout.Icon>
            <Callout.Text>
              During the closed beta we will be using a 2-of-3 multisig contract instead of a DLC. The keys are
              distributed among the borrower, the lender and Lendasat.
            </Callout.Text>
          </Callout.Root>
        </Box>
        <Box py={"3"} className="px-4">
          <Text className={"text-font dark:text-font-dark"} as="label" size="2" weight={"medium"}>
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
                  to="https://tos.lendasat.com/"
                  className="text-blue-600 hover:underline dark:text-blue-400"
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
            <Button
              variant="outline"
              size={"3"}
              className="text-sm text-font dark:text-font-dark"
              onClick={() => onDeclining()}
            >
              Decline
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action className="grow">
            <Button
              disabled={!isAccepted}
              variant="solid"
              size={"3"}
              color={"purple"}
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
