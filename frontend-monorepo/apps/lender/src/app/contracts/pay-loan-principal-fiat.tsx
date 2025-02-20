import type { Contract } from "@lendasat/http-client-lender";
import { Button, Flex } from "@radix-ui/themes";
import { BankingDetailsSummary } from "@lendasat/ui-shared";

interface RepaymentDetailsProps {
  contract: Contract;
  onPrincipalGiven: () => void;
  isLoading: boolean;
}

const RepaymentDetailsFiat = ({
  contract,
  onPrincipalGiven,
  isLoading,
}: RepaymentDetailsProps) => {
  const onConfirm = () => {
    onPrincipalGiven();
  };

  return (
    <Flex direction={"column"}>
      <BankingDetailsSummary
        fiatLoanDetails={contract.fiat_loan_details_borrower}
      />

      <Button onClick={onConfirm} disabled={isLoading}>
        Mark principal given
      </Button>
    </Flex>
  );
};

export default RepaymentDetailsFiat;
