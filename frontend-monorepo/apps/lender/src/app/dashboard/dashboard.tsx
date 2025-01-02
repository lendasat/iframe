import { ContractStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import { Box, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { useAsync } from "react-use";
import DashboardContracts from "./dashoard-contracts";

function Dashboard() {
  const { innerHeight } = window;

  const { getContracts } = useLenderHttpClient();

  const { value: maybeContracts } = useAsync(async () => {
    return await getContracts();
  }, []);

  const contracts = maybeContracts || [];

  const openContracts = contracts
    .filter((contract) => contract.status === ContractStatus.PrincipalGiven);

  const numberOfOpenContracts = openContracts.length;
  const totalLoanAmount = openContracts
    .reduce((sum, contract) => sum + contract.loan_amount, 0);
  const totalOpenInterest = openContracts.reduce((sum, contract) =>
    sum + (
      contract.loan_amount * (contract.interest_rate / 12 * contract.duration_months)
    ), 0);

  const totalClosedInterest = contracts.filter((contract) =>
    contract.status === ContractStatus.Closed || contract.status === ContractStatus.Closing
  ).reduce((sum, contract) =>
    sum + (
      contract.loan_amount * (contract.interest_rate / 12 * contract.duration_months)
    ), 0);

  return (
    <Box
      className="flex flex-col overflow-y-scroll p-4 md:p-8 dark:bg-dark"
      height={innerHeight - 120 + "px"}
    >
      <Box className="space-y-8">
        <Grid className="md:grid-cols-2 xl:grid-cols-4 gap-5">
          <QuickBoards
            color="orange"
            label="Total Assets in Open Loan"
            value={totalLoanAmount}
          />
          <QuickBoards
            color="green"
            label="Number of Active Loans"
            value={numberOfOpenContracts}
            numbers={true}
          />
          <QuickBoards
            color="purple"
            label="Open Interest"
            value={totalOpenInterest}
          />
          <QuickBoards
            color="brown"
            label="Earned Interest"
            value={totalClosedInterest}
          />
        </Grid>

        <DashboardContracts contracts={contracts} />
      </Box>
    </Box>
  );
}

export default Dashboard;

interface QuickBoardsType {
  color: string;
  label: string;
  value: number;
  numbers?: boolean;
}
const QuickBoards = ({ color, label, value, numbers }: QuickBoardsType) => {
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
          <Text as="p" size={"1"} weight={"medium"} className="text-font dark:text-font-dark">
            {label}
          </Text>
          <Heading size={"6"} weight={"bold"} className="text-black dark:text-white">
            {numbers ? value : formatCurrency(value)}
          </Heading>
        </Box>
      </Flex>
    </Box>
  );
};
