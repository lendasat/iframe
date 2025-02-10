import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { ReactElement } from "react";
import Bitrefil from "../../../assets/bitrefil.png";
import Defi from "../../../assets/defi.png";
import Sepa from "../../../assets/sepa.jpg";
import "./../../components/scrollbar.css";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert } from "react-bootstrap";
import { PayWithMoonDescriptionDialog } from "./PayWithMoonDescriptionDialog";
import { StableCoinDescriptionDialog } from "./StableCoinDescriptionDialog";

interface Step1Props {
  onSelect: (option: LoanProductOption | undefined) => void;
  selectedOption?: LoanProductOption;
}

export const Step1PickOption = ({ onSelect, selectedOption }: Step1Props) => {
  const { enabledFeatures } = useAuth();

  return (
    <Box className="py-6 md:py-8 grid md:grid-cols-2 xl:grid-cols-3 gap-5 px-6 md:px-8 xl:px-8">
      {enabledFeatures.map((option, index) => {
        let component;
        switch (option) {
          case LoanProductOption.PayWithMoonDebitCard:
            component = (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Receive a Moon Visa® Card"}
                key={index}
                disabled={false}
                image={<img src={Sepa} alt="SEPA" />}
                // image={<MoonCard />}
                // image={<img src={Moon} alt="PayWithMoon" className="max-h-full max-w-full" />}
              />
            );
            break;
          case LoanProductOption.BringinBankAccount:
            component = (
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
            break;
          case LoanProductOption.BitrefillDebitCard:
            component = (
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
            break;
          case LoanProductOption.StableCoins:
            component = (
              <ProductOptionComponent
                onSelect={onSelect}
                option={option}
                selectedOption={selectedOption}
                title={"Receive stablecoins"}
                key={index}
                disabled={false}
                image={<img src={Defi} alt="Defi" className="max-h-full max-w-full" />}
              />
            );
            break;
        }

        return component;
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
              <FontAwesomeIcon icon={faExclamationCircle} className="text-font dark:text-font-dark h-4 w-4 mr-2" />
              Currently not available.
            </Alert>
          )}
        </div>
      );
    case LoanProductOption.StableCoins:
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
    case LoanProductOption.BringinBankAccount:
    case LoanProductOption.BitrefillDebitCard:
  }
};
