import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { Alert } from "react-bootstrap";
import { PayWithMoonDescriptionDialog } from "./PayWithMoonDescriptionDialog";
import { StableCoinDescriptionDialog } from "./StableCoinDescriptionDialog";

interface LoanOptionsDescriptionDialogProps {
  option: LoanProductOption;
  selectedOption: LoanProductOption | undefined;
  onSelect: (option: LoanProductOption | undefined) => void;
  disabled: boolean;
}

export const LoanOptionsDescriptionDialog = ({
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
