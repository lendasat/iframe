import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import type { ReactElement, ReactNode } from "react";
import Bitrefil from "../../../assets/bitrefil.png";
import Defi from "../../../assets/defi.jpg";
import Moon from "../../../assets/moon.jpg";
import Sepa from "../../../assets/sepa.jpg";
import "./../../components/scrollbar.css";
import { StableCoinDescriptionDialog } from "./StableCoinDescriptionDialog";

interface Step1Props {
  onSelect: (option: LoanProductOption) => void;
  selectedOption?: LoanProductOption;
}

export const Step1PickOption = ({ onSelect, selectedOption }: Step1Props) => {
  const { enabledFeatures } = useAuth();

  return (
    <Box className="py-6 md:py-8 grid md:grid-cols-2 xl:grid-cols-3 gap-5 px-6 md:px-8">
      {enabledFeatures.map((option, index) => {
        switch (option) {
          case LoanProductOption.PayWithMoonDebitCard:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Debit card by PayWithMoon"}
                key={index}
                image={<img src={Moon} alt="PayWithMoon" />}
              />
            );
          case LoanProductOption.StableCoins:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Receive stable coins"}
                key={index}
                image={<img src={Defi} alt="DEFI" />}
              />
            );
          case LoanProductOption.BringinBankAccount:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"To a bank account using SEPA via Bringin"}
                key={index}
                image={<img src={Sepa} alt="SEPA" />}
              />
            );
          case LoanProductOption.BitrefillDebitCard:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"A debit card by Bitrefill"}
                key={index}
                image={<img src={Bitrefil} alt="Bitrefil" />}
              />
            );
          default:
            return (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Receive stable coins"}
                key={index}
                image={<img src={Defi} alt="DEFI" />}
              />
            );
        }
      })}
    </Box>
  );
};

interface ProductOptionComponentProps {
  onSelect: (option: LoanProductOption) => void;
  option: LoanProductOption | LoanProductOption.PayWithMoonDebitCard;
  selectedOption: LoanProductOption | undefined;
  title: string;
  image: ReactElement;
}

function ProductOptionComponent({
  onSelect,
  option,
  selectedOption,
  title,
  image,
}: ProductOptionComponentProps) {
  const isSelected = selectedOption === option;

  return (
    <Box className="text-left w-full max-w-[350px]">
      <Text as="p" size={"3"} weight={"bold"}>
        {title}
      </Text>
      <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
        {image}
      </Box>
      <Flex className="justify-center gap-4">
        <Button
          variant="soft"
          size={"3"}
          color={isSelected ? "purple" : "gray"}
          className="w-1/3"
          onClick={() => onSelect(option)}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
        <LoanOptionsDescriptionDialog
          option={option}
        >
          <Button
            variant="soft"
            size={"3"}
            color={"blue"}
            className="w-1/3"
          >
            Details
          </Button>
        </LoanOptionsDescriptionDialog>
      </Flex>
    </Box>
  );
}

interface LoanOptionsDescriptionDialogProps {
  children: ReactNode;
  option?: LoanProductOption;
}

const LoanOptionsDescriptionDialog = ({
  children,
  option,
}: LoanOptionsDescriptionDialogProps) => {
  switch (option) {
    case LoanProductOption.StableCoins:
    default:
      return <StableCoinDescriptionDialog option={option}>{children}</StableCoinDescriptionDialog>;
  }
};
