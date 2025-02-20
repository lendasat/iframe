import {
  Contract,
  ContractStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { formatCurrency, ONE_YEAR } from "@frontend/ui-shared";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import DashboardContracts from "./dashoard-contracts";

enum QuickBoardsType {
  Dollar,
  Number,
  Percentage,
}

interface QuickBoardsProps {
  color: string;
  label: string;
  value: number;
  type: QuickBoardsType;
}

const QuickBoards = ({ color, label, value, type }: QuickBoardsProps) => {
  let formattedValue = value.toFixed();
  switch (type) {
    case QuickBoardsType.Dollar:
      formattedValue = formatCurrency(value);
      break;
    case QuickBoardsType.Number:
      formattedValue = value.toFixed();
      break;
    case QuickBoardsType.Percentage:
      formattedValue = `${(value * 100).toFixed(1)}%`;
      break;
  }

  return (
    <Box className="min-h-24 bg-white dark:bg-dark-500 py-4 rounded-2xl space-y-4 drop-shadow-sm">
      <Flex className={`relative px-4`} align={"start"} justify={"between"}>
        <Box
          className="absolute left-0 top-0 h-full w-1 rounded-r-lg"
          style={{
            backgroundColor: color,
          }}
        />
        <Box className="space-y-3">
          <Text
            as="p"
            size={"1"}
            weight={"medium"}
            className="text-font dark:text-font-dark"
          >
            {label}
          </Text>
          <Heading
            size={"6"}
            weight={"bold"}
            className="text-black dark:text-white"
          >
            {formattedValue}
          </Heading>
        </Box>
      </Flex>
    </Box>
  );
};

interface AlertBoardProps {
  color: string;
}

const AlertBoard = ({ color }: AlertBoardProps) => {
  const navigate = useNavigate();

  return (
    <Box className="min-h-24 bg-white dark:bg-dark-500 py-4 rounded-2xl space-y-4 drop-shadow-sm">
      <Flex className={`relative px-4`} align={"start"} justify={"between"}>
        <Box
          className="absolute left-0 top-0 h-full w-1 rounded-r-lg"
          style={{
            backgroundColor: color,
          }}
        />
        <Box className="space-y-3">
          <Text
            as="p"
            size={"1"}
            weight={"medium"}
            className="text-font dark:text-font-dark"
          >
            Attention
          </Text>
          <Callout.Root color={"orange"}>
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>
              For your security, please create a backup of your seed phrase
              before proceeding.
            </Callout.Text>
            <Button onClick={() => navigate("/settings/wallet")}>
              Go to Settings
            </Button>
          </Callout.Root>
        </Box>
      </Flex>
    </Box>
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

  const { value: maybeContracts } = useAsync(async () => {
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
    <Box
      className="flex flex-col overflow-y-scroll p-4 md:p-8 dark:bg-dark"
      height={innerHeight - 120 + "px"}
    >
      <Box className="space-y-8">
        <Grid className="md:grid-cols-2 xl:grid-cols-5 gap-5">
          <QuickBoards
            color="orange"
            label="$ in Open Loans"
            value={totalLoanAmount}
            type={QuickBoardsType.Dollar}
          />
          <QuickBoards
            color="green"
            label="Number of Active Loans"
            value={numberOfOpenContracts}
            type={QuickBoardsType.Number}
          />
          <QuickBoards
            color="purple"
            label="Open Interest"
            value={totalOpenInterest}
            type={QuickBoardsType.Dollar}
          />
          <QuickBoards
            color="brown"
            label="Earned Interest"
            value={totalClosedInterest}
            type={QuickBoardsType.Dollar}
          />
          <QuickBoards
            color="yellow"
            label="Average APR"
            value={averageApr}
            type={QuickBoardsType.Percentage}
          />
        </Grid>
        {!hasMnemonicBackedUp && <AlertBoard color={"red"} />}

        <DashboardContracts contracts={contracts} />
      </Box>
    </Box>
  );
}

export default Dashboard;
