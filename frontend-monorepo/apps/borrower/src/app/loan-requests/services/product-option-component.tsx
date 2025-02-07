import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { ReactElement } from "react";
import { LoanOptionsDescriptionDialog } from "./loan-option-description-dialog";

interface ProductOptionComponentProps {
  onSelect: (option: LoanProductOption | undefined) => void;
  option: LoanProductOption | LoanProductOption.PayWithMoonDebitCard;
  selectedOption: LoanProductOption | undefined;
  title: string;
  image: ReactElement;
  disabled: boolean;
}

export const ProductOptionComponent = ({
  onSelect,
  option,
  selectedOption,
  title,
  image,
  disabled = false,
}: ProductOptionComponentProps) => {
  return (
    <Box className="text-left w-full max-w-[350px]">
      <Text className={"text-font dark:text-font-dark"} as="p" size={"3"} weight={"bold"}>
        {title}
      </Text>
      <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl flex justify-center items-center">
        {image}
      </Box>
      <Flex className="justify-center gap-4">
        <LoanOptionsDescriptionDialog
          option={option}
          onSelect={onSelect}
          selectedOption={selectedOption}
          disabled={disabled}
        >
        </LoanOptionsDescriptionDialog>
      </Flex>
    </Box>
  );
};
