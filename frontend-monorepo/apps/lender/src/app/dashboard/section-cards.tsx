import { Contract, ContractStatus } from "@frontend/http-client-lender";
import { formatCurrency, ONE_YEAR } from "@frontend/ui-shared";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@frontend/shadcn";

const calculateWeightedAverageAPR = (contracts: Contract[]) => {
  if (contracts.length === 0) {
    return 0;
  }

  let totalWeightedValue = 0;
  let totalLoanAmount = 0;

  contracts.forEach((contract) => {
    totalWeightedValue += contract.interest_rate * contract.loan_amount;
    totalLoanAmount += contract.loan_amount;
  });

  return totalWeightedValue / totalLoanAmount;
};

export interface SectionCardsProps {
  contracts: Contract[];
  isLoading: boolean;
}

export const SectionCards = ({ contracts, isLoading }: SectionCardsProps) => {
  const openContracts = contracts.filter(
    (contract) => contract.status === ContractStatus.PrincipalGiven,
  );

  const numberOfOpenContracts = openContracts.length;
  const totalLoanAmount = openContracts.reduce(
    (sum, contract) => sum + contract.loan_amount,
    0,
  );
  const totalOpenInterest = openContracts.reduce(
    (sum, contract) =>
      sum +
      contract.loan_amount *
        ((contract.interest_rate / ONE_YEAR) * contract.duration_days),
    0,
  );

  const closedContracts = contracts.filter(
    (contract) =>
      contract.status === ContractStatus.Closed ||
      contract.status === ContractStatus.Closing ||
      contract.status === ContractStatus.Extended,
  );
  const totalClosedInterest = closedContracts.reduce(
    (sum, contract) =>
      sum +
      contract.loan_amount *
        ((contract.interest_rate / ONE_YEAR) * contract.duration_days),
    0,
  );

  const averageApr = calculateWeightedAverageAPR(closedContracts).toFixed(2);

  return (
    <div className="flex flex-col gap-4 mt-4 md:gap-6 md:max-w-full">
      <div
        className={
          "grid gap-4 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-5 xl:grid-cols-5 px-6"
        }
      >
        <Card>
          <CardHeader>
            <CardDescription>Open Loans</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton className="h-8 w-[150px]" />
              ) : (
                formatCurrency(totalLoanAmount)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active Loans</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton className="h-8 w-[150px]" />
              ) : (
                numberOfOpenContracts
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open Interest</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton className="h-8 w-[150px]" />
              ) : (
                formatCurrency(totalOpenInterest)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Earned Interest</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton className="h-8 w-[150px]" />
              ) : (
                formatCurrency(totalClosedInterest)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Average APR</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton className="h-8 w-[150px]" />
              ) : (
                <>
                  {averageApr}
                  {"%"}
                </>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};
