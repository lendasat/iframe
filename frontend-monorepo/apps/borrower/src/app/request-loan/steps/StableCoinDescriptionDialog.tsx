import type { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { AlertDialog, Box, Button, Checkbox, Flex, Separator, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

interface StableCoinDescriptionDialogProps {
  children: ReactNode;
  option?: LoanProductOption;
}

export const StableCoinDescriptionDialog = ({
  children,
  option,
}: StableCoinDescriptionDialogProps) => {
  const [checked, setChecked] = useState<LoanProductOption | undefined>(undefined);
  const isChecked = checked === option;

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        {children}
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px" className="rounded-lg">
        <Box className="py-4 text-center max-w-sm mx-auto">
          <Flex align={"center"} justify={"center"} gap={"3"} pb={"1"}>
            <Separator size={"3"} className="bg-font/30" />
            <AlertDialog.Title className="shrink-0 p-0 m-0">Receive stable coins</AlertDialog.Title>
            <Separator size={"3"} className="bg-font/30" />
          </Flex>
        </Box>
        <Box className="relative bg-slate-50 py-3">
          <Box className="max-h-72 overflow-y-scroll px-4 custom-scrollbar">
            <AlertDialog.Description size="2" className="text-pretty leading-[1.8] text-font/60">
              <Text size={"2"} className="text-font">
                Picking this option you will receive the loan amount as stable coins to a from you selected address. You
                may receive your loan as stable coins on various different chains including (but not limited to):
                <ul className="list-disc ml-6">
                  {StableCoinHelper.all().map((item, index) => <li key={index}>{StableCoinHelper.print(item)}</li>)}
                </ul>
                This gives you maximum flexibility, e.g. you can transfer the coins to a preferred exchange, buy more
                Bitcoin on a DEX or use the coins in any Defi application.
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
                checked={isChecked}
                onCheckedChange={() => {
                  if (isChecked) {
                    setChecked(undefined);
                  } else {
                    setChecked(option);
                  }
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
            <Button variant="outline" size={"3"} className="text-sm" color="gray">
              Decline
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action className="grow">
            <Button
              disabled={!checked}
              variant="solid"
              size={"3"}
              color="purple"
              className="text-sm"
            >
              Continue
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};
