import {
  formatCurrency,
  LoanAsset,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { Box, Flex, Separator, Text, Tooltip } from "@radix-ui/themes";
import { RepayStablecoins } from "./repay-contract-stablecoins";
import { RepayFiat } from "./repay-contract-fiat";
import { FiatLoanDetailsResponse } from "@frontend/base-http-client";

interface RepayContractProps {
  contractId: string;
  loanAmount: number;
  interestAmount: number;
  totalRepaymentAmount: number;
  expiry: Date;
  loanAsset: LoanAsset;
  repaymentAddress: string;
  fiatLoanDetails?: FiatLoanDetailsResponse;
}

export const RepayContract = ({
  contractId,
  loanAmount,
  interestAmount,
  totalRepaymentAmount,
  expiry,
  loanAsset,
  repaymentAddress,
  fiatLoanDetails,
}: RepayContractProps) => {
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Flex direction={"column"}>
      <Box>
        <Separator
          className="bg-font/10 dark:bg-font-dark/10"
          size={"4"}
          my={"4"}
        />
        <Box className="space-y-4">
          <Flex align={"center"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 shrink-0"
            >
              Loan Amount
            </Text>

            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 text-end"
            >
              {formatCurrency(loanAmount)}
            </Text>
          </Flex>
          <Flex align={"center"} justify={"between"}>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 shrink-0"
            >
              Interest Amount
            </Text>
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 text-end"
            >
              {formatCurrency(interestAmount)}
            </Text>
          </Flex>
          <Separator
            className="bg-font/10 dark:bg-font-dark/10"
            size={"4"}
            my={"4"}
          />
          <Flex align={"center"} justify={"between"}>
            <Text
              size={"2"}
              weight={"bold"}
              className="text-font dark:text-font-dark shrink-0"
            >
              Total Owed
            </Text>

            <Text
              size={"2"}
              weight={"bold"}
              className="text-font dark:text-font-dark text-end"
            >
              <Tooltip
                content={"Copy exact amount to send"}
                className="text-font dark:text-font-dark font-semibold"
              >
                <span
                  onClick={() => handleCopy(totalRepaymentAmount.toString())}
                  className="text-font dark:text-font-dark cursor-copy font-semibold"
                >
                  {formatCurrency(totalRepaymentAmount)} {"  "}
                </span>
              </Tooltip>
            </Text>
          </Flex>
          <Separator
            className="bg-font/10 dark:bg-font-dark/10"
            size={"4"}
            my={"4"}
          />
        </Box>

        {LoanAssetHelper.isStableCoin(loanAsset) ? (
          <RepayStablecoins
            expiry={expiry}
            loanAsset={loanAsset}
            totalRepaymentAmount={totalRepaymentAmount}
            repaymentAddress={repaymentAddress}
            contractId={contractId}
          />
        ) : (
          <RepayFiat
            fiatLoanDetails={fiatLoanDetails}
            contractId={contractId}
          />
        )}
      </Box>
    </Flex>
  );
};
