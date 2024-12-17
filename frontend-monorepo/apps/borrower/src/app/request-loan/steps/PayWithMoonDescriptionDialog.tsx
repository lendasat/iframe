import type { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { AlertDialog, Box, Button, Callout, Checkbox, Flex, Separator, Text } from "@radix-ui/themes";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { FaTrademark } from "react-icons/fa6";
import { Link } from "react-router-dom";

interface PayWithMoonDescriptionDialogProps {
  option: LoanProductOption;
  selectedOption: LoanProductOption | undefined;
  onSelect: (option: LoanProductOption | undefined) => void;
  disabled: boolean;
}

export const PayWithMoonDescriptionDialog = ({
  option,
  selectedOption,
  onSelect,
  disabled,
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
          className={`"w-full" ${isSelected ? "purple-500 dark:purple-300" : "gray-500 dark:gray-300"}`}
          disabled={disabled}
          onClick={disabled ? undefined : () => onOpening()}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="550px" className="rounded-lg bg-light dark:bg-dark">
        <Box className="py-4 text-center max-w-sm mx-auto">
          <Flex align={"center"} justify={"center"} gap={"3"} pb={"1"}>
            <Separator size={"3"} className="bg-font/30 dark:bg-font-dark/30" />
            <AlertDialog.Title className="shrink-0 p-0 m-0 text-font dark:text-font-dark">
              Moon Visa® Card
            </AlertDialog.Title>
            <Separator size={"3"} className="bg-font/30" />
          </Flex>
        </Box>
        <Box className="relative bg-slate-50 dark:bg-slate-800 py-3">
          <Box className="max-h-72 overflow-y-scroll px-4 py-3 custom-scrollbar">
            <AlertDialog.Description size="2" className="text-pretty leading-[1.8] text-font/60 dark:text-font-dark/60">
              <ul className="list-disc ml-6">
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark">Spend up to $4,000 USD per month</Text>
                </li>
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark">
                    Shop at millions of merchants in over 130 countries
                  </Text>
                </li>
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark">Valid for 3 years from creation date</Text>
                </li>
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark flex items-center gap-1">
                    Reloadable - top up your card (soon<FaTrademark className="inline-block" />)
                  </Text>
                </li>
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark">
                    No FX or Foreign transaction fees
                  </Text>
                </li>
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark">
                    A fee of 1% on spend applies (minimum of $1 per transaction)
                  </Text>
                </li>
                <li>
                  <Text size={"2"} className="text-font dark:text-font-dark">
                    Not available to residents of all countries (see Statement of Eligibility)
                  </Text>
                </li>
              </ul>
              <Callout.Root color="teal" variant="soft" highContrast>
                <Callout.Icon>
                  <FaInfoCircle />
                </Callout.Icon>
                <Callout.Text className={"dark:text-font-dark"}>
                  During the closed beta we will be using a 2-of-3 multisig contract instead of a DLC. The keys are
                  distributed among the borrower, the lender and Lendasat.
                </Callout.Text>
              </Callout.Root>
            </AlertDialog.Description>
          </Box>
          <div className="absolute bottom-0 h-7 bg-gradient-to-t from-white via-white/70 to-white/0 z-10 w-full left-0 dark:from-dark dark:via-dark/70 dark:to-dark/0" />
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
              <div>
                Accept{" "}
                <Link
                  to="https://lendasat.notion.site/Terms-of-Service-100d2f24d4cf801aa6cee15f1b77e11b?pvs=25"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Lendasat Terms & Conditions
                </Link>
                {" and "}
                <Link
                  to="https://paywithmoon.com/terms-conditions"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Moon Terms & Conditions
                </Link>
                {" and "}
                <Link
                  to="https://paywithmoon.com/terms-conditions"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Card Holder Agreement
                </Link>
                {" and "}
                <Link
                  to="https://paywithmoon.com/terms-conditions"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Statement of Eligibility
                </Link>
                {"."}
              </div>
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
