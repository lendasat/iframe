import { ContractStatus } from "@frontend-monorepo/http-client-borrower";
import { type Contract, contractStatusToLabelString, LiquidationStatus } from "@frontend-monorepo/http-client-lender";
import { CurrencyFormatter, LtvProgressBar, usePrice } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, DropdownMenu, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { actionFromStatus } from "./my-contracts";

interface OpenContractsProps {
  contracts: Contract[];
}

export const OpenContracts = ({ contracts }: OpenContractsProps) => {
  const { latestPrice } = usePrice();
  const navigate = useNavigate();

  const amount_col = {
    label: "Amount",
    md: 1,
    className: "text-center",
  };

  const expiry_col = {
    label: "Duration",
    md: 1,
    className: "text-center",
  };

  const ltv_col = {
    label: "LTV",
    md: 2,
    className: "text-center hidden xl:block",
  };
  const interest_col = {
    label: "Interest",
    md: 1,
    className: "text-center hidden md:block",
  };
  const collateral_col = {
    label: "Collateral",
    md: 2,
    className: "text-center",
  };
  const status_col = {
    label: "Status",
    md: 2,
    className: "text-center hidden md:block",
  };
  const empty_col = {
    label: "",
    md: 1,
    className: "text-center hidden xl:block",
  };

  const headers = [amount_col, expiry_col, interest_col, ltv_col, collateral_col, status_col, empty_col];

  return (
    <Box>
      <Box className="px-6 md:px-8 py-4">
        <Flex align={"center"} justify={"between"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>My Contracts</Heading>
        </Flex>
      </Box>

      <Flex align={"center"} className="bg-active-nav/15 pr-8 border-b border-font/5 dark:border-dark">
        <Box className="w-[45px] xl:w-[80px] text-center py-1">
          <Text size={"1"} weight={"medium"} className="text-font/50 dark:text-font-dark/50">S/N</Text>
        </Box>
        <Grid className="grid-cols-3 md:grid-cols-5 xl:grid-cols-7 flex-grow">
          {headers.map((header, index) => (
            <Box key={index} className={header.className}>
              <Text className="text-font/50 dark:text-font-dark/50" size={"1"} weight={"medium"}>{header.label}</Text>
            </Box>
          ))}
        </Grid>
      </Flex>

      <Box
        style={{
          overflowY: "scroll",
        }}
      >
        {contracts.length === 0
          && <p>You do not have any open contracts.</p>}

        {contracts.map((contract, index) => {
          const collateral_btc = contract.initial_collateral_sats / 100000000;
          const ltvRatio = contract.loan_amount / (collateral_btc * latestPrice);

          let contractStatus = contractStatusToLabelString(contract.status);
          const firstMarginCall = contract.liquidation_status === LiquidationStatus.FirstMarginCall;
          const secondMarginCall = contract.liquidation_status === LiquidationStatus.SecondMarginCall;
          const liquidated = contract.liquidation_status === LiquidationStatus.Liquidated;

          if (firstMarginCall) {
            contractStatus = "First Margin Call";
          }
          if (secondMarginCall) {
            contractStatus = "Second Margin Call";
          }
          if (liquidated) {
            contractStatus = "Liquidated";
          }

          return (
            <Flex
              key={index}
              align={"center"}
              className={`border-b ${
                (index + 1) % 2 === 0 ? "bg-light/50 dark:bg-dark/50" : "bg-transparent"
              } border-black/5 dark:border-dark pr-3`}
            >
              <Box className="w-[45px] xl:w-[80px] text-center py-5 border-r dark:border-dark">
                <Text size={"1"} weight={"medium"} className="text-font/50 dark:text-font-dark/50">{index + 1}</Text>
              </Box>
              <Grid className="grid-cols-3 pr-2 flex-grow md:grid-cols-5 xl:grid-cols-7 items-center text-font">
                <Box className="text-center">
                  <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                    <CurrencyFormatter value={contract.loan_amount} />
                  </Text>
                </Box>

                <Box className="justify-center text-center">
                  <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                    {contract.duration_months} months
                  </Text>
                </Box>

                <Box className="hidden md:flex justify-center">
                  <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                    {(contract.interest_rate * 100).toFixed(2)}%
                  </Text>
                </Box>

                <Box className="hidden xl:block">
                  <LtvProgressBar ltvRatio={latestPrice ? ltvRatio * 100 : undefined} />
                </Box>

                <Box className="flex justify-center">
                  <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                    {collateral_btc} BTC
                  </Text>
                </Box>

                <Box className="hidden md:flex justify-center ">
                  <Badge
                    color={contract.status === ContractStatus.Requested
                      ? "amber"
                      : contract.status === ContractStatus.Approved
                      ? "green"
                      : contract.status === ContractStatus.Rejected
                      ? "red"
                      : "gray"}
                    size={"2"}
                  >
                    {contractStatus}
                  </Badge>
                </Box>

                <Box className="hidden xl:flex justify-center">
                  <Button
                    size={"3"}
                    variant="solid"
                    className="bg-btn text-white dark:bg-dark-600 rounded-lg"
                    onClick={() => navigate(`${contract.id}`)}
                  >
                    <Text
                      size={"1"}
                      className="font-semibold"
                    >
                      {actionFromStatus(contract.status)}
                    </Text>
                  </Button>
                </Box>
              </Grid>

              {/* Responsive Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="ghost" className="xl:hidden text-font dark:text-font-dark hover:bg-transparent">
                    <BsThreeDotsVertical />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <Box width={"100%"} minWidth={"300px"} p={"3"}>
                    <Heading as="h6" weight={"medium"}>
                      More Information
                    </Heading>
                  </Box>
                  <DropdownMenu.Separator />
                  <Box width={"100%"} minWidth={"300px"} p={"3"}>
                    <Flex direction={"column"} gap={"4"} align={"start"}>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Amount
                          </Text>
                          <Text size={"3"}>
                            <CurrencyFormatter value={contract.loan_amount} />
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Duration:
                          </Text>
                          <Text className="capitalize" size={"3"}>
                            {contract.duration_months} months
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            LTV rate:
                          </Text>
                          <Box minWidth={"150px"}>
                            <LtvProgressBar ltvRatio={latestPrice ? ltvRatio * 100 : undefined} />
                          </Box>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Interest:
                          </Text>
                          <Text className="capitalize" size={"3"}>
                            TODO
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Collateral:
                          </Text>
                          <Text className="capitalize" size={"3"}>
                            {collateral_btc} BTC
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Status:
                          </Text>
                          <Text className="capitalize" size={"3"}>
                            <Badge
                              color={contract.status === ContractStatus.Requested
                                ? "amber"
                                : contract.status === ContractStatus.Approved
                                ? "green"
                                : contract.status === ContractStatus.Rejected
                                ? "red"
                                : "gray"}
                              size={"2"}
                            >
                              {contractStatus}
                            </Badge>
                          </Text>
                        </Flex>
                      </Box>
                      <Button
                        size={"3"}
                        variant="solid"
                        className="bg-btn text-white dark:bg-dark-600 w-full active:scale-90"
                        onClick={() => navigate(`${contract.id}`)}
                      >
                        <Text
                          size={"2"}
                          className="font-semibold"
                        >
                          {actionFromStatus(contract.status)}
                        </Text>
                      </Button>
                    </Flex>
                  </Box>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Flex>
          );
        })}
      </Box>
    </Box>
  );
};
