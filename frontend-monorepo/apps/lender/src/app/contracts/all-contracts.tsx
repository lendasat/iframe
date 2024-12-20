import { ContractStatus } from "@frontend-monorepo/http-client-borrower";
import { type Contract, contractStatusToLabelString, LiquidationStatus } from "@frontend-monorepo/http-client-lender";
import { CurrencyFormatter, LtvProgressBar, usePrice } from "@frontend-monorepo/ui-shared";
import { InfoCircledIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Callout, Checkbox, DropdownMenu, Flex, Heading, Table, Text } from "@radix-ui/themes";
import { formatDistance } from "date-fns";
import { useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoCaretDownOutline, IoCaretUp } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { actionFromStatus } from "./my-contracts";

interface OpenContractsProps {
  contracts: Contract[];
}

type ColumnFilterKey =
  | "updatedAt"
  | "amount"
  | "duration"
  | "interest"
  | "ltv"
  | "collateral"
  | "status"
  | "action";
type ColumnFilter = Record<ColumnFilterKey, boolean>;

type ContractStatusFilterKey =
  | "requested"
  | "opening"
  | "open"
  | "closed"
  | "closing"
  | "rejected"
  | "expired"
  | "canceled"
  | "dispute";

type ContractStatusFilter = Record<ContractStatusFilterKey, boolean>;

function getCaretColor(sortByColumn: ColumnFilterKey, currentColumnKey: ColumnFilterKey, sortAsc: boolean) {
  if (sortByColumn !== currentColumnKey) {
    return "text-font/40 dark:text-font-dark/40";
  }

  return sortAsc
    ? "text-font dark:text-font-dark"
    : "text-font/40 dark:text-font-dark/40";
}

function getColumnHeaderColor(sortByColumn: ColumnFilterKey, currentColumnKey: ColumnFilterKey) {
  if (sortByColumn !== currentColumnKey) {
    return "text-font/40 dark:text-font-dark/40";
  }

  return "text-font dark:text-font-dark";
}

interface ColumnHeaderProps {
  toggleSortByColumn: (column: ColumnFilterKey) => void;
  sortByColumn: ColumnFilterKey;
  currentColumn: ColumnFilterKey;
  sortAsc: boolean;
  label: string;
}

const ColumnHeader = ({ toggleSortByColumn, sortByColumn, currentColumn, sortAsc, label }: ColumnHeaderProps) => (
  <Button onClick={() => toggleSortByColumn(currentColumn)} className="bg-transparent px-0">
    <Flex gap={"1"} align={"center"}>
      <Text
        size={"1"}
        weight={"medium"}
        className={getColumnHeaderColor(sortByColumn, currentColumn)}
      >
        {label}
      </Text>
      <Box>
        <IoCaretUp
          className={`text-[10px] -mb-1 ${getCaretColor(sortByColumn, currentColumn, sortAsc)}`}
        />
        <IoCaretDownOutline
          className={`text-[10px] -mb-1 ${getCaretColor(sortByColumn, currentColumn, !sortAsc)}`}
        />
      </Box>
    </Flex>
  </Button>
);

export const AllContracts = ({ contracts: unfilteredContracts }: OpenContractsProps) => {
  const { latestPrice } = usePrice();
  const navigate = useNavigate();

  const [shownColumns, setShownColumns] = useState<ColumnFilter>({
    updatedAt: true,
    amount: true,
    duration: true,
    interest: true,
    ltv: true,
    collateral: true,
    status: true,
    action: true,
  });

  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatusFilter>({
    requested: true,
    opening: true,
    open: true,
    closing: true,
    closed: true,
    rejected: false,
    expired: false,
    canceled: false,
    dispute: true,
  });

  const [sortByColumn, setSortByColumn] = useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleFilterOutContractDetails = (filterName: ColumnFilterKey) => {
    setShownColumns(prev => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };
  const toggleContractStatusFilter = (filterName: ContractStatusFilterKey) => {
    setContractStatusFilter(prev => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };

  const contracts = unfilteredContracts.filter((contract) => {
    switch (contract.status) {
      case ContractStatus.Requested:
        return contractStatusFilter["requested"];
      case ContractStatus.Approved:
      case ContractStatus.CollateralSeen:
      case ContractStatus.CollateralConfirmed:
        return contractStatusFilter["opening"];
      case ContractStatus.PrincipalGiven:
        return contractStatusFilter["open"];
      case ContractStatus.Closing:
      case ContractStatus.RepaymentProvided:
      case ContractStatus.RepaymentConfirmed:
        return contractStatusFilter["closing"];
      case ContractStatus.Closed:
        return contractStatusFilter["closed"];
      case ContractStatus.Rejected:
        return contractStatusFilter["rejected"];
      case ContractStatus.DisputeBorrowerStarted:
      case ContractStatus.DisputeLenderStarted:
      case ContractStatus.DisputeBorrowerResolved:
      case ContractStatus.DisputeLenderResolved:
        return contractStatusFilter["dispute"];
      case ContractStatus.Cancelled:
        return contractStatusFilter["canceled"];
      case ContractStatus.RequestExpired:
        return contractStatusFilter["expired"];
      default:
        return contractStatusFilter["expired"];
    }
  }).sort((a, b) => {
    let dif;
    switch (sortByColumn) {
      case "updatedAt":
        dif = a.updated_at.getTime() - b.updated_at.getTime();
        break;
      case "amount":
        dif = a.loan_amount - b.loan_amount;
        break;
      case "duration":
        dif = a.duration_months - b.duration_months;
        break;
      case "interest":
        dif = a.interest_rate - b.interest_rate;
        break;
      case "ltv":
        // TODO: this is wrong, we should calculate the current LTV
        dif = a.initial_ltv - b.initial_ltv;
        break;
      case "collateral":
        dif = a.collateral_sats - b.collateral_sats;
        break;
      case "status":
      case "action":
      default:
        dif = a.status.localeCompare(b.status);
        break;
    }
    return sortAsc ? dif : -dif;
  });

  function toggleSortByColumn(column: ColumnFilterKey) {
    setSortByColumn(column);
    setSortAsc(!sortAsc);
  }

  return (
    <Box className={"pb-20"}>
      <Box className="px-6 md:px-8 py-4">
        <Flex gap={"1"} align={"center"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>My Contracts</Heading>
          <Flex className={"justify-center"}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="outline" size="2">
                  <MixerHorizontalIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content size="1">
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["amount"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("amount")}
                    />
                    <Text>Amount</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["duration"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("duration")}
                    />
                    <Text>Duration</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["interest"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("interest")}
                    />
                    <Text>Interest</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["ltv"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("ltv")}
                    />
                    <Text>LTV</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["collateral"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("collateral")}
                    />
                    <Text>Collateral</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["status"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("status")}
                    />
                    <Text>Status</Text>
                  </Flex>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
        </Flex>
      </Box>

      <Box className="px-6 md:px-8 py-4">
        <Table.Root variant="surface" size={"2"} layout={"auto"}>
          <Table.Header>
            <Table.Row>
              {shownColumns["amount"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <ColumnHeader
                      toggleSortByColumn={toggleSortByColumn}
                      sortByColumn={sortByColumn}
                      sortAsc={sortAsc}
                      currentColumn={"amount"}
                      key={"amount"}
                      label={"Amount"}
                    />
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["duration"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <Box className="hidden md:flex">
                      <ColumnHeader
                        toggleSortByColumn={toggleSortByColumn}
                        sortByColumn={sortByColumn}
                        sortAsc={sortAsc}
                        currentColumn={"duration"}
                        label={"Duration"}
                        key={"duration"}
                      />
                    </Box>
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["interest"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <Box className="hidden md:flex">
                      <ColumnHeader
                        toggleSortByColumn={toggleSortByColumn}
                        sortByColumn={sortByColumn}
                        sortAsc={sortAsc}
                        currentColumn={"interest"}
                        label={"Interest"}
                        key={"interest"}
                      />
                    </Box>
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["ltv"]
                && (
                  <Table.ColumnHeaderCell
                    justify={"center"}
                    minWidth={"100px"}
                    className={"text-font dark:text-font-dark"}
                  >
                    <ColumnHeader
                      toggleSortByColumn={toggleSortByColumn}
                      sortByColumn={sortByColumn}
                      sortAsc={sortAsc}
                      currentColumn={"ltv"}
                      label={"LTV"}
                      key={"ltv"}
                    />
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["collateral"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <ColumnHeader
                      toggleSortByColumn={toggleSortByColumn}
                      sortByColumn={sortByColumn}
                      sortAsc={sortAsc}
                      currentColumn={"collateral"}
                      key={"collateral"}
                      label={"Collateral"}
                    />
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["status"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <Flex gap={"1"} align={"center"} className={"hidden md:flex"}>
                      <ColumnHeader
                        toggleSortByColumn={toggleSortByColumn}
                        sortByColumn={sortByColumn}
                        sortAsc={sortAsc}
                        currentColumn={"status"}
                        key={"status"}
                        label={"Status"}
                      />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          <Button variant={"outline"} size="1">
                            <MixerHorizontalIcon />
                          </Button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content size="1">
                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["requested"]}
                                onCheckedChange={() => toggleContractStatusFilter("requested")}
                              />
                              <Text>Requested</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["opening"]}
                                onCheckedChange={() => toggleContractStatusFilter("opening")}
                              />
                              <Text>Opening</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["open"]}
                                onCheckedChange={() => toggleContractStatusFilter("open")}
                              />
                              <Text>Open</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["closing"]}
                                onCheckedChange={() => toggleContractStatusFilter("closing")}
                              />
                              <Text>Closing</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["closed"]}
                                onCheckedChange={() => toggleContractStatusFilter("closed")}
                              />
                              <Text>Closed</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["rejected"]}
                                onCheckedChange={() => toggleContractStatusFilter("rejected")}
                              />
                              <Text>Rejected</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["expired"]}
                                onCheckedChange={() => toggleContractStatusFilter("expired")}
                              />
                              <Text>Expired</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["canceled"]}
                                onCheckedChange={() => toggleContractStatusFilter("canceled")}
                              />
                              <Text>Canceled</Text>
                            </Flex>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Flex gap="2" align="center">
                              <Checkbox
                                checked={contractStatusFilter["dispute"]}
                                onCheckedChange={() => toggleContractStatusFilter("dispute")}
                              />
                              <Text>Disputes</Text>
                            </Flex>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Flex>
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["action"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <Box className="hidden md:flex">
                      <ColumnHeader
                        toggleSortByColumn={toggleSortByColumn}
                        sortByColumn={sortByColumn}
                        sortAsc={sortAsc}
                        currentColumn={"action"}
                        key={"action"}
                        label={"Action"}
                      />
                    </Box>
                  </Table.ColumnHeaderCell>
                )}
              {shownColumns["updatedAt"]
                && (
                  <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
                    <Box className="hidden md:flex">
                      <ColumnHeader
                        toggleSortByColumn={toggleSortByColumn}
                        sortByColumn={sortByColumn}
                        sortAsc={sortAsc}
                        currentColumn={"updatedAt"}
                        key={"updatedAt"}
                        label={"Last Update"}
                      />
                    </Box>
                  </Table.ColumnHeaderCell>
                )}
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {contracts.length === 0
              && (
                <Table.Cell colSpan={8}>
                  <Callout.Root color={"blue"}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      You don't have any contracts yet.
                    </Callout.Text>
                  </Callout.Root>
                </Table.Cell>
              )}

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
                <Table.Row key={index}>
                  {shownColumns["amount"]
                    && (
                      <Table.RowHeaderCell>
                        <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                          <CurrencyFormatter value={contract.loan_amount} />
                        </Text>
                      </Table.RowHeaderCell>
                    )}
                  {shownColumns["duration"]
                    && (
                      <Table.Cell>
                        <Box className="hidden md:flex">
                          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                            {contract.duration_months} months
                          </Text>
                        </Box>
                      </Table.Cell>
                    )}
                  {shownColumns["interest"]
                    && (
                      <Table.Cell>
                        <Box className="hidden md:flex">
                          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                            {(contract.interest_rate * 100).toFixed(2)}%
                          </Text>
                        </Box>
                      </Table.Cell>
                    )}
                  {shownColumns["ltv"]
                    && (
                      <Table.Cell>
                        <LtvProgressBar ltvRatio={latestPrice ? ltvRatio * 100 : undefined} />
                      </Table.Cell>
                    )}
                  {shownColumns["collateral"]
                    && (
                      <Table.Cell>
                        <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                          {collateral_btc} BTC
                        </Text>
                      </Table.Cell>
                    )}
                  {shownColumns["status"]
                    && (
                      <Table.Cell>
                        <Box className="hidden md:flex">
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
                      </Table.Cell>
                    )}
                  {shownColumns["action"]
                    && (
                      <Table.Cell>
                        <Box className="hidden xl:flex">
                          <Button
                            size={"2"}
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
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <Button
                              variant="ghost"
                              className="xl:hidden text-font dark:text-font-dark hover:bg-transparent"
                            >
                              <BsThreeDotsVertical />
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content className={"bg-light dark:bg-dark"}>
                            <Box width={"100%"} minWidth={"300px"} p={"3"}>
                              <Heading className={"text-font dark:text-font-dark"} as="h6" weight={"medium"}>
                                More Information
                              </Heading>
                            </Box>
                            <DropdownMenu.Separator />
                            <Box width={"100%"} minWidth={"300px"} p={"3"}>
                              <Flex direction={"column"} gap={"4"} align={"start"}>
                                <Box width={"100%"}>
                                  <Flex align={"center"} justify={"between"} gap={"3"}>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                                      Amount
                                    </Text>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"}>
                                      <CurrencyFormatter value={contract.loan_amount} />
                                    </Text>
                                  </Flex>
                                </Box>
                                <Box width={"100%"}>
                                  <Flex align={"center"} justify={"between"} gap={"3"}>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                                      Duration:
                                    </Text>
                                    <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                                      {contract.duration_months} months
                                    </Text>
                                  </Flex>
                                </Box>
                                <Box width={"100%"}>
                                  <Flex align={"center"} justify={"between"} gap={"3"}>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                                      LTV rate:
                                    </Text>
                                    <Box minWidth={"150px"}>
                                      <LtvProgressBar ltvRatio={latestPrice ? ltvRatio * 100 : undefined} />
                                    </Box>
                                  </Flex>
                                </Box>
                                <Box width={"100%"}>
                                  <Flex align={"center"} justify={"between"} gap={"3"}>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                                      Interest:
                                    </Text>
                                    <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                                      TODO
                                    </Text>
                                  </Flex>
                                </Box>
                                <Box width={"100%"}>
                                  <Flex align={"center"} justify={"between"} gap={"3"}>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                                      Collateral:
                                    </Text>
                                    <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
                                      {collateral_btc} BTC
                                    </Text>
                                  </Flex>
                                </Box>
                                <Box width={"100%"}>
                                  <Flex align={"center"} justify={"between"} gap={"3"}>
                                    <Text className={"text-font dark:text-font-dark"} size={"3"} weight={"medium"}>
                                      Status:
                                    </Text>
                                    <Text className="capitalize text-font dark:text-font-dark" size={"3"}>
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
                      </Table.Cell>
                    )}
                  {shownColumns["updatedAt"]
                    && (
                      <Table.RowHeaderCell>
                        <Box className="hidden md:flex">
                          <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                            {formatDistance(contract.updated_at, new Date(), { addSuffix: true })}
                          </Text>
                        </Box>
                      </Table.RowHeaderCell>
                    )}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
};
