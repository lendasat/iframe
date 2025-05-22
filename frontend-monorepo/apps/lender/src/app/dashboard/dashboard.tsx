import {
  Contract,
  ContractStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { formatCurrency, ONE_YEAR } from "@frontend/ui-shared";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import DashboardContracts from "./dashoard-contracts";
import { InfoIcon } from "lucide-react";

const AlertBoard = () => {
  const navigate = useNavigate();

  return (
    <Alert>
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>Attention</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        For your security, please create a backup of your seed phrase before
        proceeding.
        <Button onClick={() => navigate("/settings/wallet")} size={"sm"}>
          Go to Settings
        </Button>
      </AlertDescription>
    </Alert>
  );
};

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

function Dashboard() {
  const { innerHeight } = window;

  const { getContracts } = useLenderHttpClient();

  const [hasMnemonicBackedUp, setHasMnemonicBackedUp] = useState(false);

  const { value: maybeContracts, loading: isLoading } = useAsync(async () => {
    return await getContracts();
  }, []);

  useEffect(() => {
    const storedBackup = localStorage.getItem("mnemonicBackedUp");
    if (storedBackup) {
      setHasMnemonicBackedUp(JSON.parse(storedBackup));
    }
  }, []);

  const contracts = maybeContracts || [];

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

  const averageApr = calculateWeightedAverageAPR(closedContracts);

  return (
    <div
      className="flex flex-col overflow-y-scroll p-4 md:p-8"
      style={{ height: innerHeight - 120 + "px" }}
    >
      <div className="space-y-8">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader>
              <CardDescription>Open Loans</CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
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
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
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
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
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
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
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
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
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
        {!hasMnemonicBackedUp && <AlertBoard />}

        <DashboardContracts contracts={contracts} />
      </div>
    </div>
  );
}

export default Dashboard;
