import { formatCurrency } from "@frontend-monorepo/ui-shared";
import { Box, Button, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import DashboardContracts from "./dashoard-contracts";

function Dashboard() {
  const { innerHeight } = window;
  const [chartNav, setChartNav] = useState<string>("Earning");
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
            value={1000000}
          />
          <QuickBoards
            color="green"
            label="Number of Active Loans"
            value={3}
            numbers={true}
          />
          <QuickBoards
            color="purple"
            label="Open Intrest"
            value={3102}
          />
          <QuickBoards
            color="brown"
            label="Earned Interest"
            value={1243}
          />
        </Grid>

        <DashboardContracts />

        <Box className="min-h-96 border-b space-y-4">
          <Flex align={"center"} justify={"between"} wrap={"wrap"} gap={"2"}>
            <Heading className="text-black dark:text-white">
              Peformace Chart
            </Heading>
            <Box className="bg-white dark:bg-dark-500 flex items-center gap-1 p-1 rounded-xl">
              {["Earning", "Interest"].map((navs, index) => (
                <Button
                  size={"3"}
                  key={index}
                  onClick={() => setChartNav(navs)}
                  className={`text-[13px] font-normal ${
                    chartNav == navs ? "bg-purple-800" : "bg-transparent text-font/60 dark:text-font-dark/60"
                  } px-6 max-h-9 rounded-lg`}
                >
                  {navs}
                </Button>
              ))}
            </Box>
          </Flex>
          <Box className="flex items-center justify-center">
            <Heading size={"8"}>
              Chart Section
            </Heading>
          </Box>
        </Box>
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
      <Flex className="px-4" align={"center"} gap={"2"}>
        {/* would be replaced with an area chart showing daily change in value */}
        <Text size={"2"} weight={"regular"} className="text-black dark:text-white">
          Area Chart
        </Text>
      </Flex>
    </Box>
  );
};
