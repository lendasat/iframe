import {
  contractStatusToLabelString,
  LoanType,
} from "@frontend/http-client-borrower";
import type { Contract } from "@frontend/http-client-borrower";
import { formatCurrency } from "@frontend/ui-shared";
import { Callout } from "@radix-ui/themes";
import { FaInfoCircle } from "react-icons/fa";

interface CollateralSeenOrConfirmedProps {
  collateral: string;
  collateralAddress: string;
  contract: Contract;
}

export function CollateralSeenOrConfirmed({
  collateral,
  collateralAddress,
  contract,
}: CollateralSeenOrConfirmedProps) {
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let info;
  switch (contract.loan_type) {
    case LoanType.PayWithMoon:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)} will be
          sent to your Moon card. Once confirmed, you will receive an email and
          you can start using your card.
        </>
      );
      break;
    case LoanType.StableCoin:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)} will be
          sent to this address.
          <div className="mt-2">
            <input
              type="text"
              value={contract.borrower_loan_address}
              disabled
              readOnly
              className="w-full bg-white dark:bg-dark-700 text-font dark:text-font-dark p-2 border border-gray-300 rounded"
            />
          </div>
        </>
      );
      break;
    case LoanType.Fiat:
      info = (
        <>
          Your loan amount of {formatCurrency(contract.loan_amount)} will be
          sent your bank account.
        </>
      );
      break;
  }

  return (
    <div className="w-full">
      <h4 className="text-font dark:text-font-dark">
        {contractStatusToLabelString(contract.status)}
      </h4>

      <div className="mt-4 flex justify-center items-center flex-col">
        <p className="text-font dark:text-font-dark break-words mt-2">
          <strong>{collateral} BTC</strong> are locked in{" "}
          <strong>{collateralAddress}</strong>.{/* TODO: add transaction id */}
        </p>
      </div>

      <div className="mt-4">
        <Callout.Root color="teal">
          <Callout.Icon>
            <FaInfoCircle className="text-font dark:text-font-dark" size="18" />
          </Callout.Icon>
          <Callout.Text className="text-font dark:text-font-dark">
            {info}
          </Callout.Text>
        </Callout.Root>
      </div>
    </div>
  );
}
