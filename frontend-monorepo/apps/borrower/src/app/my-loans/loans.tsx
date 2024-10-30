import type { Contract } from "@frontend-monorepo/http-client-borrower";
import {
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
} from "@frontend-monorepo/http-client-borrower";
import {
  CurrencyFormatter,
  LtvInfoLabel,
  LtvProgressBar,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, DropdownMenu, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FaInfoCircle } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { collateralForStatus } from "./collateralForStatus";

interface LoansComponentProps {
  loans: Contract[];
}

function ContractsComponent({ loans }: LoansComponentProps) {
  const { latestPrice } = usePrice();
  const navigate = useNavigate();

  if (loans.length === 0) {
    return <p>You don't have any loans yet.</p>;
  }

  const amount_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Amount
        </Text>
      </div>
    ),
    md: 1,
    className: "text-center",
  };

  const expiry_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Expiry
        </Text>
      </div>
    ),
    md: 2,
    className: "text-center",
  };

  const ltv_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <LtvInfoLabel>
          <Text className="text-font/50" size={"1"} weight={"medium"}>
            LTV
          </Text>
          <FaInfoCircle color={"gray"} />
        </LtvInfoLabel>
      </div>
    ),
    md: 2,
    className: "text-center hidden xl:block",
  };
  const interest_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Interest
        </Text>
      </div>
    ),
    md: 1,
    className: "text-center hidden md:block",
  };
  const collateral_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Collateral
        </Text>
      </div>
    ),
    md: 2,
    className: "text-center",
  };
  const status_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Status
        </Text>
      </div>
    ),
    md: 2,
    className: "text-center hidden md:block",
  };
  const empty_col = {
    label: "",
    md: 2,
    className: "text-center",
  };

  const repaid_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Closed on
        </Text>
      </div>
    ),
    md: 2,
    className: "text-center",
  };

  const coin_col = {
    label: (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Text className="text-font/50" size={"1"} weight={"medium"}>
          Coin
        </Text>
      </div>
    ),
    md: 2,
    className: "text-center hidden xl:block",
  };

  const headers = [amount_col, expiry_col, interest_col, ltv_col, collateral_col, status_col, empty_col];
  const headerClosed = [amount_col, repaid_col, interest_col, coin_col, collateral_col, status_col, empty_col];
  const { innerHeight } = window;
  return (
    <Box>
      <Box className="px-6 md:px-8 py-4">
        <Flex align={"center"} justify={"between"}>
          <Heading size={"6"}>My Loans</Heading>
          <Button asChild color="purple" className="text-sm" size={"3"}>
            <Link to={"/requests"}>
              New Request
            </Link>
          </Button>
        </Flex>
      </Box>

      <Flex align={"center"} className="bg-active-nav/15 pr-8 border-b border-font/5">
        <Box className="w-[45px] xl:w-[80px] text-center py-1">
          <Text size={"1"} weight={"medium"} className="text-font/50">S/N</Text>
        </Box>
        <Grid className="grid-cols-3 md:grid-cols-5 xl:grid-cols-7 flex-grow">
          {headers.map((header, index) => (
            <Box key={index} className={header.className}>
              {header.label}
            </Box>
          ))}
        </Grid>
      </Flex>

      <Box
        style={{
          overflowY: "scroll",
          height: innerHeight * 0.4,
        }}
      >
        {loans.map((loan, index) => {
          const {
            id,
            loan_amount,
            expiry,
            interest_rate,
            initial_collateral_sats,
            status,
            liquidation_status,
            collateral_sats,
          } = loan;

          const collateral_btc = collateralForStatus(status, initial_collateral_sats, collateral_sats) / 100000000;

          const ltvRatio = loan_amount / (collateral_btc * latestPrice);

          const firstMarginCall = liquidation_status === LiquidationStatus.FirstMarginCall;
          const secondMarginCall = liquidation_status === LiquidationStatus.SecondMarginCall;
          const liquidated = liquidation_status === LiquidationStatus.Liquidated;

          let contractStatusLabel = contractStatusToLabelString(status);
          if (firstMarginCall) {
            contractStatusLabel = "First Margin Call";
          }
          if (secondMarginCall) {
            contractStatusLabel = "Second Margin Call";
          }
          if (liquidated) {
            contractStatusLabel = "Liquidated";
          }

          if (loan.status === ContractStatus.Closed) {
            return null;
          }

          return (
            <Flex
              key={index}
              align={"center"}
              className={`border-b ${(index + 1) % 2 === 0 ? "bg-white/50" : "bg-transparent"} border-black/5 pr-3`}
            >
              <Box className="w-[45px] xl:w-[80px] text-center py-5 border-r">
                <Text size={"1"} weight={"medium"} className="text-font/50">{index + 1}</Text>
              </Box>
              <Grid className="grid-cols-3 pr-2 flex-grow md:grid-cols-5 xl:grid-cols-7 items-center text-font">
                <Box className="text-center">
                  <Text size={"1"} weight={"medium"}>
                    <CurrencyFormatter value={loan_amount} />
                  </Text>
                </Box>

                <Box className="justify-center text-center">
                  <Text size={"1"} weight={"medium"}>
                    {expiry.toLocaleDateString()}
                  </Text>
                </Box>

                <Box className="hidden md:flex justify-center">
                  <Text size={"1"} weight={"medium"}>
                    {(interest_rate * 100).toFixed(2)}%
                  </Text>
                </Box>

                <Box className="hidden xl:block">
                  <LtvProgressBar ltvRatio={latestPrice ? ltvRatio * 100 : undefined} />
                </Box>

                <Box className="flex justify-center">
                  <Text size={"1"} weight={"medium"}>
                    {collateral_btc} BTC
                  </Text>
                </Box>

                <Box className="hidden md:flex justify-center ">
                  <Badge
                    color={status === ContractStatus.Requested
                      ? "amber"
                      : status === ContractStatus.Approved
                      ? "green"
                      : status === ContractStatus.Rejected
                      ? "red"
                      : "gray"}
                    size={"2"}
                  >
                    {contractStatusLabel}
                  </Badge>
                </Box>

                <Box className="hidden xl:flex justify-center">
                  <Button
                    size={"3"}
                    variant="solid"
                    className="bg-btn text-white rounded-lg"
                    onClick={() => navigate(`${id}`)}
                  >
                    <Text
                      size={"1"}
                      className="font-semibold"
                    >
                      {actionFromStatus(status)}
                    </Text>
                  </Button>
                </Box>
              </Grid>

              {/* Responsive Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="ghost" className="xl:hidden text-font hover:bg-transparent">
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
                            <CurrencyFormatter value={loan_amount} />
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Expiry date:
                          </Text>
                          <Text className="capitalize" size={"3"}>
                            {expiry.toLocaleDateString()}
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <LtvInfoLabel>
                            <Flex align={"center"} gap={"2"} className="text-font-dark">
                              <Text size={"3"} weight={"medium"}>
                                LTV ratio
                              </Text>
                              <FaInfoCircle />
                            </Flex>
                          </LtvInfoLabel>
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
                            {(interest_rate * 100).toFixed(2)}%
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
                              color={status === ContractStatus.Requested
                                ? "amber"
                                : status === ContractStatus.Approved
                                ? "green"
                                : status === ContractStatus.Rejected
                                ? "red"
                                : "gray"}
                              size={"2"}
                            >
                              {contractStatusLabel}
                            </Badge>
                          </Text>
                        </Flex>
                      </Box>
                      <Button
                        size={"3"}
                        variant="solid"
                        className="bg-btn text-white w-full active:scale-90"
                        onClick={() => navigate(`${id}`)}
                      >
                        <Text
                          size={"1"}
                          className="font-semibold"
                        >
                          {actionFromStatus(status)}
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

      <ClosedLoans
        loans={loans}
        header={headerClosed}
        latestPrice={latestPrice}
      />
    </Box>
  );
}

export default ContractsComponent;

const actionFromStatus = (status: ContractStatus) => {
  switch (status) {
    case ContractStatus.Requested:
      return "Details";
    case ContractStatus.Approved:
      return "Fund it now";
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      return "Details";
    case ContractStatus.PrincipalGiven:
      return "Repay";
    case ContractStatus.Closed:
    case ContractStatus.Closing:
      return "Details";
    case ContractStatus.Repaid:
      return "Withdraw collateral";
    case ContractStatus.Rejected:
      return "Details";
    case ContractStatus.DisputeBorrowerStarted:
      return "Details";
    case ContractStatus.DisputeLenderStarted:
      return "Details";
    case ContractStatus.DisputeBorrowerResolved:
      return "Details";
    case ContractStatus.DisputeLenderResolved:
      return "Details";
  }
};

interface ClosedPorps {
  header: ({
    label: string;
    md: number;
    className: string;
  } | {
    label: JSX.Element;
    md: number;
    className: string;
  })[];
  loans: Contract[];
  latestPrice: number;
}

const ClosedLoans = ({ header, loans, latestPrice }: ClosedPorps) => {
  const { innerHeight } = window;
  const navigate = useNavigate();
  return (
    <Box>
      <Box className="px-6 md:px-8 py-4">
        <Flex align={"center"} justify={"between"}>
          <Heading size={"6"}>Loan Closed</Heading>
        </Flex>
      </Box>

      <Flex align={"center"} className="bg-active-nav/15 pr-8 border-b border-font/5">
        <Box className="w-[45px] xl:w-[80px] text-center py-1">
          <Text size={"1"} weight={"medium"} className="text-font/50">S/N</Text>
        </Box>
        <Grid className="grid-cols-3 md:grid-cols-5 xl:grid-cols-7 flex-grow">
          {header.map((header, index) => (
            <Box key={index} className={header.className}>
              {header.label}
            </Box>
          ))}
        </Grid>
      </Flex>

      <Box
        style={{
          overflowY: "scroll",
          height: innerHeight * 0.25,
        }}
      >
        {loans.map((loan, index) => {
          const {
            id,
            loan_amount,
            repaid_at,
            interest_rate,
            initial_collateral_sats,
            status,
            liquidation_status,
            collateral_sats,
            loan_asset_chain,
            loan_asset_type,
          } = loan;

          const collateral_btc = collateralForStatus(status, initial_collateral_sats, collateral_sats) / 100000000;

          const firstMarginCall = liquidation_status === LiquidationStatus.FirstMarginCall;
          const secondMarginCall = liquidation_status === LiquidationStatus.SecondMarginCall;
          const liquidated = liquidation_status === LiquidationStatus.Liquidated;

          let contractStatusLabel = contractStatusToLabelString(status);
          if (firstMarginCall) {
            contractStatusLabel = "First Margin Call";
          }
          if (secondMarginCall) {
            contractStatusLabel = "Second Margin Call";
          }
          if (liquidated) {
            contractStatusLabel = "Liquidated";
          }

          const coin = StableCoinHelper.mapFromBackend(
            loan_asset_chain,
            loan_asset_type,
          );
          // if (loan.status !== ContractStatus.Closed) {
          //   return null;
          // }

          return (
            <Flex
              key={index}
              align={"center"}
              className={`border-b ${(index + 1) % 2 === 0 ? "bg-white/50" : "bg-transparent"} border-black/5 pr-3`}
            >
              <Box className="w-[45px] xl:w-[80px] text-center py-5 border-r">
                <Text size={"1"} weight={"medium"} className="text-font/50">{index + 1}</Text>
              </Box>
              <Grid className="grid-cols-3 pr-2 flex-grow md:grid-cols-5 xl:grid-cols-7 items-center text-font">
                <Box className="text-center">
                  <Text size={"1"} weight={"medium"}>
                    <CurrencyFormatter value={loan_amount} />
                  </Text>
                </Box>

                <Box className="justify-center text-center">
                  {repaid_at
                    ? (
                      <Text size={"1"} weight={"medium"}>
                        {repaid_at.toLocaleDateString("en-US")}
                      </Text>
                    )
                    : ""}
                </Box>

                <Box className="hidden md:flex justify-center">
                  <Text size={"1"} weight={"medium"}>
                    {(interest_rate * 100).toFixed(2)}%
                  </Text>
                </Box>

                <Box className="hidden xl:block text-center">
                  <Badge color="purple">{coin ? StableCoinHelper.print(coin) : ""}</Badge>
                </Box>

                <Box className="flex justify-center">
                  <Text size={"1"} weight={"medium"}>
                    {collateral_btc} BTC
                  </Text>
                </Box>

                <Box className="hidden md:flex justify-center ">
                  <Badge
                    color={status === ContractStatus.Requested
                      ? "amber"
                      : status === ContractStatus.Approved
                      ? "green"
                      : status === ContractStatus.Rejected
                      ? "red"
                      : "gray"}
                    size={"2"}
                  >
                    {contractStatusLabel}
                  </Badge>
                </Box>

                <Box className="hidden xl:flex justify-center">
                  <Button
                    size={"3"}
                    variant="solid"
                    className="bg-btn text-white rounded-lg"
                    onClick={() => navigate(`${id}`)}
                  >
                    <Text
                      size={"1"}
                      className="font-semibold"
                    >
                      {actionFromStatus(status)}
                    </Text>
                  </Button>
                </Box>
              </Grid>

              {/* Responsive Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="ghost" className="xl:hidden text-font hover:bg-transparent">
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
                            <CurrencyFormatter value={loan_amount} />
                          </Text>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Closed on:
                          </Text>
                          {repaid_at
                            ? (
                              <Text size={"3"} weight={"medium"}>
                                {repaid_at.toLocaleDateString("en-US")}
                              </Text>
                            )
                            : ""}
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Coin:
                          </Text>
                          <Box>
                            <Badge color="purple">{coin ? StableCoinHelper.print(coin) : ""}</Badge>
                          </Box>
                        </Flex>
                      </Box>
                      <Box width={"100%"}>
                        <Flex align={"center"} justify={"between"} gap={"3"}>
                          <Text size={"3"} weight={"medium"}>
                            Interest:
                          </Text>
                          <Text className="capitalize" size={"3"}>
                            {(interest_rate * 100).toFixed(2)}%
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
                              color={status === ContractStatus.Requested
                                ? "amber"
                                : status === ContractStatus.Approved
                                ? "green"
                                : status === ContractStatus.Rejected
                                ? "red"
                                : "gray"}
                              size={"2"}
                            >
                              {contractStatusLabel}
                            </Badge>
                          </Text>
                        </Flex>
                      </Box>
                      <Button
                        size={"3"}
                        variant="solid"
                        className="bg-btn text-white w-full active:scale-90"
                        onClick={() => navigate(`${id}`)}
                      >
                        <Text
                          size={"1"}
                          className="font-semibold"
                        >
                          {actionFromStatus(status)}
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
