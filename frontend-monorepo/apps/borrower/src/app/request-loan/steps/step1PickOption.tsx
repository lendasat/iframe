import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useAuth, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { ReactElement } from "react";
import Bitrefil from "../../../assets/bitrefil.png";
import Defi from "../../../assets/defi.jpg";
import Moon from "../../../assets/moon.jpg";
import Sepa from "../../../assets/sepa.jpg";
import "./../../components/scrollbar.css";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert } from "react-bootstrap";
import { useAsync } from "react-use";
import { PayWithMoonDescriptionDialog } from "./PayWithMoonDescriptionDialog";
import { StableCoinDescriptionDialog } from "./StableCoinDescriptionDialog";

interface Step1Props {
  onSelect: (option: LoanProductOption | undefined) => void;
  selectedOption?: LoanProductOption;
}

export const Step1PickOption = ({ onSelect, selectedOption }: Step1Props) => {
  const { enabledFeatures } = useAuth();
  const { getUserCards } = useBorrowerHttpClient();

  const { loading, value, error } = useAsync(async () => {
    if (enabledFeatures.includes(LoanProductOption.PayWithMoonDebitCard)) {
      return getUserCards();
    }
    return [];
  });

  if (error) {
    console.error(`Failed fetching credit cards ${error}`);
  }

  const hasAlreadyCard = loading ? true : value ? value.length > 0 : false;

  return (
    <Box className="py-6 md:py-8 grid md:grid-cols-2 xl:grid-cols-3 gap-5 px-6 md:px-8 xl:px-8">
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
                disabled={hasAlreadyCard}
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
                disabled={false}
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
                disabled={false}
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
                disabled={false}
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
                disabled={false}
                image={<img src={Defi} alt="DEFI" />}
              />
            );
        }
      })}
    </Box>
  );
};

interface ProductOptionComponentProps {
  onSelect: (option: LoanProductOption | undefined) => void;
  option: LoanProductOption | LoanProductOption.PayWithMoonDebitCard;
  selectedOption: LoanProductOption | undefined;
  title: string;
  image: ReactElement;
  disabled: boolean;
}

function ProductOptionComponent({
  onSelect,
  option,
  selectedOption,
  title,
  image,
  disabled = false,
}: ProductOptionComponentProps) {
  return (
    <Box className="text-left w-full max-w-[350px]">
      <Text as="p" size={"3"} weight={"bold"}>
        {title}
      </Text>
      <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
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
}

interface LoanOptionsDescriptionDialogProps {
  option: LoanProductOption;
  selectedOption: LoanProductOption | undefined;
  onSelect: (option: LoanProductOption | undefined) => void;
  disabled: boolean;
}

const LoanOptionsDescriptionDialog = ({
  option,
  onSelect,
  selectedOption,
  disabled,
}: LoanOptionsDescriptionDialogProps) => {
  switch (option) {
    case LoanProductOption.PayWithMoonDebitCard:
      return (
        <div className="flex flex-col gap-3 w-full">
          <div className="flex justify-center">
            <PayWithMoonDescriptionDialog
              onSelect={onSelect}
              option={option}
              selectedOption={selectedOption}
              disabled={disabled}
            >
            </PayWithMoonDescriptionDialog>
          </div>
          {disabled && (
            <Alert variant="warning">
              <FontAwesomeIcon icon={faExclamationCircle} className="h-4 w-4 mr-2" />
              You can only have one debit card at the moment.
            </Alert>
          )}
        </div>
      );
    case LoanProductOption.StableCoins:
    default:
      return (
        <div className="flex flex-col gap-3 w-full">
          <div className="flex justify-center w-full">
            <StableCoinDescriptionDialog
              option={option}
              onSelect={onSelect}
              selectedOption={selectedOption}
              disabled={disabled}
            >
            </StableCoinDescriptionDialog>
          </div>
        </div>
      );
  }
};
