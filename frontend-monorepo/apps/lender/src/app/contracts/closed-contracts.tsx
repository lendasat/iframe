import { ContractStatus } from "@frontend/http-client-borrower";
import {
  type Contract,
  contractStatusToLabelString,
  LiquidationStatus,
} from "@frontend/http-client-lender";
import { actionFromStatus } from "@frontend/http-client-lender";
import {
  CurrencyFormatter,
  getFormatedStringFromDays,
  LtvProgressBar,
} from "@frontend/ui-shared";
import {
  Badge,
  Box,
  Button,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  Text,
} from "@radix-ui/themes";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useNavigate } from "react-router-dom";

interface ClosedContractsProps {
  contracts: Contract[];
}

export const ClosedContracts = ({ contracts }: ClosedContractsProps) => {
  const navigate = useNavigate();

  const amount_col = {
    label: "Amount",
    md: 1,
    className: "text-center",
  };

  const closed_on = {
    label: "Closed on",
    md: 1,
    className: "text-center",
  };
  const interest_col = {
    label: "Interest",
    md: 1,
    className: "text-center hidden md:block",
  };
  const status_col = {
    label: "Status",
    md: 2,
    className: "text-center",
  };
  const empty_col = {
    label: "",
    md: 1,
    className: "text-center hidden xl:block",
  };

  const headers = [amount_col, closed_on, interest_col, status_col, empty_col];

  return (
    <>
      <Box className="px-6 py-4 md:px-8">
        <Flex align={"center"} justify={"between"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>
            Closed Contracts
          </Heading>
        </Flex>
      </Box>

      <Flex
        align={"center"}
        className="bg-active-nav/15 border-font/5 dark:border-font-dark/5 border-b pr-8"
      >
        <Box className="w-[45px] py-1 text-center xl:w-[80px]">
          <Text
            size={"1"}
            weight={"medium"}
            className="text-font/50 dark:text-font-dark/50"
          >
            S/N
          </Text>
        </Box>
        <Grid className="flex-grow grid-cols-3 md:grid-cols-5 xl:grid-cols-5">
          {headers.map((header) => (
            <Box key={header.label} className={header.className}>
              <Text
                className="text-font/50 dark:text-font-dark/50"
                size={"1"}
                weight={"medium"}
              >
                {header.label}
              </Text>
            </Box>
          ))}
        </Grid>
      </Flex>

      <Box
        style={{
          overflowY: "scroll",
        }}
      >
        {contracts.length === 0 && (
          <p className={"text-font dark:text-font-dark"}>
            You do not have any closed contracts.
          </p>
        )}

        {contracts.map((contract, index) => {
          const collateral_btc = contract.collateral_sats / 100000000;

          let contractStatus = contractStatusToLabelString(contract.status);
          const firstMarginCall =
            contract.liquidation_status === LiquidationStatus.FirstMarginCall;
          const secondMarginCall =
            contract.liquidation_status === LiquidationStatus.SecondMarginCall;
          const liquidated =
            contract.liquidation_status === LiquidationStatus.Liquidated;

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
              key={contract.id}
              align={"center"}
              className={`border-b ${
                (index + 1) % 2 === 0
                  ? "bg-light/50 dark:bg-dark/50"
                  : "bg-transparent"
              } dark:border-dark border-black/5 pr-3`}
            >
              <Box className="dark:border-dark w-[45px] border-r py-5 text-center xl:w-[80px]">
                <Text
                  size={"1"}
                  weight={"medium"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  {index + 1}
                </Text>
              </Box>
              <Grid className="text-font flex-grow grid-cols-3 items-center pr-2 md:grid-cols-5 xl:grid-cols-5">
                <Box className="text-center">
                  <Text
                    className={"text-font dark:text-font-dark"}
                    size={"1"}
                    weight={"medium"}
                  >
                    <CurrencyFormatter value={contract.loan_amount} />
                  </Text>
                </Box>

                <Box className="justify-center text-center">
                  <Text
                    className={"text-font dark:text-font-dark"}
                    size={"1"}
                    weight={"medium"}
                  >
                    {contract.updated_at?.toLocaleDateString()}
                  </Text>
                </Box>

                <Box className="hidden justify-center md:flex">
                  <Text
                    className={"text-font dark:text-font-dark"}
                    size={"1"}
                    weight={"medium"}
                  >
                    {(contract.interest_rate * 100).toFixed(2)}%
                  </Text>
                </Box>

                <Box className="flex justify-center">
                  <Badge
                    color={
                      contract.status === ContractStatus.Requested
                        ? "amber"
                        : contract.status === ContractStatus.Approved
                          ? "green"
                          : contract.status === ContractStatus.Rejected
                            ? "red"
                            : "gray"
                    }
                    size={"2"}
                  >
                    {contractStatus}
                  </Badge>
                </Box>

                <Box className="hidden justify-center xl:flex">
                  <Button
                    size={"3"}
                    variant="solid"
                    className="bg-btn dark:bg-dark-600 rounded-lg text-white"
                    onClick={() => navigate(`${contract.id}`)}
                  >
                    <Text size={"1"} className="font-semibold">
                      {actionFromStatus(contract.status)}
                    </Text>
                  </Button>
                </Box>
              </Grid>

              {/* Responsive Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button
                    variant="ghost"
                    className="text-font dark:text-font-dark hover:bg-transparent xl:hidden"
                  >
                    <BsThreeDotsVertical />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content className={"bg-light dark:bg-dark"}>
                  <Box width={"100%"} minWidth={"300px"} p={"3"}>
                    <Heading
                      className={"text-font dark:text-font-dark"}
                      as="h6"
                      weight={"medium"}
                    >
                      More Information
                    </Heading>
                  </Box>
                  <DropdownMenu.Separator />
                  <Box width={"100%"} minWidth={"300px"} p={"3"}>
                    <Flex direction={"column"} gap={"4"} align={"start"}>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                            weight={"medium"}
                          >
                            Amount
                          </Text>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                          >
                            <CurrencyFormatter value={contract.loan_amount} />
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                            weight={"medium"}
                          >
                            Duration:
                          </Text>
                          <Text
                            className="text-font dark:text-font-dark capitalize"
                            size={"3"}
                          >
                            {getFormatedStringFromDays(contract.duration_days)}
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                            weight={"medium"}
                          >
                            LTV rate:
                          </Text>
                          <Box minWidth={"150px"}>
                            <LtvProgressBar
                              collateralBtc={collateral_btc}
                              loanAmount={contract.loan_amount}
                            />
                          </Box>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                            weight={"medium"}
                          >
                            Interest:
                          </Text>
                          <Text
                            className="text-font dark:text-font-dark capitalize"
                            size={"3"}
                          >
                            TODO
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                            weight={"medium"}
                          >
                            Collateral:
                          </Text>
                          <Text
                            className="text-font dark:text-font-dark capitalize"
                            size={"3"}
                          >
                            {collateral_btc} BTC
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text
                            className={"text-font dark:text-font-dark"}
                            size={"3"}
                            weight={"medium"}
                          >
                            Status:
                          </Text>
                          <Text
                            className="text-font dark:text-font-dark capitalize"
                            size={"3"}
                          >
                            <Badge
                              color={
                                contract.status === ContractStatus.Requested
                                  ? "amber"
                                  : contract.status === ContractStatus.Approved
                                    ? "green"
                                    : contract.status ===
                                        ContractStatus.Rejected
                                      ? "red"
                                      : "gray"
                              }
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
                        className="bg-btn dark:bg-dark-600 w-full text-white active:scale-90"
                        onClick={() => navigate(`${contract.id}`)}
                      >
                        <Text size={"2"} className="font-semibold">
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
    </>
  );
};
