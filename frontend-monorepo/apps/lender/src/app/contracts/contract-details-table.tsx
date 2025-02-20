import {
  actionFromStatus,
  type Contract,
  ContractStatus,
  contractStatusToLabelString,
  LiquidationStatus,
} from "@lendasat/http-client-lender";
import { CurrencyFormatter, LtvProgressBar } from "@lendasat/ui-shared";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Callout,
  DropdownMenu,
  Flex,
  Heading,
  Table,
  Text,
} from "@radix-ui/themes";
import { formatDistance } from "date-fns";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoCaretDownOutline, IoCaretUp } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

export type ColumnFilterKey =
  | "updatedAt"
  | "amount"
  | "expiry"
  | "interest"
  | "ltv"
  | "collateral"
  | "status"
  | "action";

export type ColumnFilter = Record<ColumnFilterKey, boolean>;

function getCaretColor(
  sortByColumn: ColumnFilterKey,
  currentColumnKey: ColumnFilterKey,
  sortAsc: boolean,
) {
  if (sortByColumn !== currentColumnKey) {
    return "text-font/40 dark:text-font-dark/40";
  }

  return sortAsc
    ? "text-font dark:text-font-dark"
    : "text-font/40 dark:text-font-dark/40";
}

function getColumnHeaderColor(
  sortByColumn: ColumnFilterKey,
  currentColumnKey: ColumnFilterKey,
) {
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

const ColumnHeader = ({
  toggleSortByColumn,
  sortByColumn,
  currentColumn,
  sortAsc,
  label,
}: ColumnHeaderProps) => (
  <Button
    onClick={() => toggleSortByColumn(currentColumn)}
    className="bg-transparent px-0"
  >
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
          className={`text-[10px] -mb-1 ${getCaretColor(
            sortByColumn,
            currentColumn,
            sortAsc,
          )}`}
        />
        <IoCaretDownOutline
          className={`text-[10px] -mb-1 ${getCaretColor(
            sortByColumn,
            currentColumn,
            !sortAsc,
          )}`}
        />
      </Box>
    </Flex>
  </Button>
);

export interface ContractDetailsTableProps {
  shownColumns: ColumnFilter;
  toggleSortByColumn: (column: ColumnFilterKey) => void;
  sortByColumn: ColumnFilterKey;
  sortAsc: boolean;
  contracts: Contract[];
  latestPrice: number;
}

export const ContractDetailsTable = ({
  shownColumns,
  toggleSortByColumn,
  sortByColumn,
  sortAsc,
  contracts,
  latestPrice,
}: ContractDetailsTableProps) => {
  const navigate = useNavigate();

  return (
    <Table.Root variant="surface" size={"2"} layout={"auto"}>
      <Table.Header>
        <Table.Row>
          {shownColumns["amount"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn={"amount"}
                label={"Amount"}
              />
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["expiry"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <Box className="hidden md:flex">
                <ColumnHeader
                  toggleSortByColumn={toggleSortByColumn}
                  sortByColumn={sortByColumn}
                  sortAsc={sortAsc}
                  currentColumn={"expiry"}
                  label={"Expiry"}
                />
              </Box>
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["interest"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <Box className="hidden md:flex">
                <ColumnHeader
                  toggleSortByColumn={toggleSortByColumn}
                  sortByColumn={sortByColumn}
                  sortAsc={sortAsc}
                  currentColumn={"interest"}
                  label={"Interest"}
                />
              </Box>
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["ltv"] && (
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
              />
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["collateral"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <Box className={"hidden md:flex"}>
                <ColumnHeader
                  toggleSortByColumn={toggleSortByColumn}
                  sortByColumn={sortByColumn}
                  sortAsc={sortAsc}
                  currentColumn={"collateral"}
                  label={"Collateral"}
                />
              </Box>
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["status"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <Flex gap={"1"} align={"center"} className={"hidden md:flex"}>
                <ColumnHeader
                  toggleSortByColumn={toggleSortByColumn}
                  sortByColumn={sortByColumn}
                  sortAsc={sortAsc}
                  currentColumn={"status"}
                  label={"Status"}
                />
              </Flex>
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["updatedAt"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <Box className="hidden md:flex">
                <ColumnHeader
                  toggleSortByColumn={toggleSortByColumn}
                  sortByColumn={sortByColumn}
                  sortAsc={sortAsc}
                  currentColumn={"updatedAt"}
                  label={"Last Update"}
                />
              </Box>
            </Table.ColumnHeaderCell>
          )}
          {shownColumns["action"] && (
            <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
              <Box className="hidden md:flex">
                <ColumnHeader
                  toggleSortByColumn={toggleSortByColumn}
                  sortByColumn={sortByColumn}
                  sortAsc={sortAsc}
                  currentColumn={"action"}
                  label={"Action"}
                />
              </Box>
            </Table.ColumnHeaderCell>
          )}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {contracts.length === 0 && (
          <Table.Cell colSpan={8}>
            <Callout.Root color={"blue"}>
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>No contracts found.</Callout.Text>
            </Callout.Root>
          </Table.Cell>
        )}

        {contracts.map((contract, index) => {
          const collateral_btc = contract.initial_collateral_sats / 100000000;

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
            <Table.Row key={index}>
              {shownColumns["amount"] && (
                <Table.RowHeaderCell>
                  <Text
                    className={"text-font dark:text-font-dark"}
                    size={"1"}
                    weight={"medium"}
                  >
                    <CurrencyFormatter value={contract.loan_amount} />
                  </Text>
                </Table.RowHeaderCell>
              )}
              {shownColumns["expiry"] && (
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {contract.expiry?.toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </Box>
                </Table.Cell>
              )}
              {shownColumns["interest"] && (
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {(contract.interest_rate * 100).toFixed(2)}%
                    </Text>
                  </Box>
                </Table.Cell>
              )}
              {shownColumns["ltv"] && (
                <Table.Cell>
                  <LtvProgressBar
                    collateralBtc={collateral_btc}
                    loanAmount={contract.loan_amount}
                  />
                </Table.Cell>
              )}
              {shownColumns["collateral"] && (
                <Table.Cell>
                  <Text
                    className={"text-font dark:text-font-dark hidden md:flex"}
                    size={"1"}
                    weight={"medium"}
                  >
                    {collateral_btc} BTC
                  </Text>
                </Table.Cell>
              )}
              {shownColumns["status"] && (
                <Table.Cell>
                  <Box className="hidden md:flex">
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
                </Table.Cell>
              )}
              {shownColumns["updatedAt"] && (
                <Table.RowHeaderCell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {formatDistance(contract.updated_at, new Date(), {
                        addSuffix: true,
                      })}
                    </Text>
                  </Box>
                </Table.RowHeaderCell>
              )}
              {shownColumns["action"] && (
                <Table.Cell>
                  <Box className="hidden xl:flex">
                    <Button
                      size={"2"}
                      variant="solid"
                      className="bg-btn text-white dark:bg-dark-600 rounded-lg"
                      onClick={() => navigate(`/my-contracts/${contract.id}`)}
                    >
                      <Text size={"1"} className="font-semibold">
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
                            <Flex
                              align={"center"}
                              justify={"between"}
                              gap={"3"}
                            >
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
                                <CurrencyFormatter
                                  value={contract.loan_amount}
                                />
                              </Text>
                            </Flex>
                          </Box>
                          <Box width={"100%"}>
                            <Flex
                              align={"center"}
                              justify={"between"}
                              gap={"3"}
                            >
                              <Text
                                className={"text-font dark:text-font-dark"}
                                size={"3"}
                                weight={"medium"}
                              >
                                Expiry:
                              </Text>
                              <Text
                                className="capitalize text-font dark:text-font-dark"
                                size={"3"}
                              >
                                {contract.expiry.toLocaleDateString([], {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </Text>
                            </Flex>
                          </Box>
                          <Box width={"100%"}>
                            <Flex
                              align={"center"}
                              justify={"between"}
                              gap={"3"}
                            >
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
                            <Flex
                              align={"center"}
                              justify={"between"}
                              gap={"3"}
                            >
                              <Text
                                className={"text-font dark:text-font-dark"}
                                size={"3"}
                                weight={"medium"}
                              >
                                Interest:
                              </Text>
                              <Text
                                className="capitalize text-font dark:text-font-dark"
                                size={"3"}
                              >
                                TODO
                              </Text>
                            </Flex>
                          </Box>
                          <Box width={"100%"}>
                            <Flex
                              align={"center"}
                              justify={"between"}
                              gap={"3"}
                            >
                              <Text
                                className={"text-font dark:text-font-dark"}
                                size={"3"}
                                weight={"medium"}
                              >
                                Collateral:
                              </Text>
                              <Text
                                className="capitalize text-font dark:text-font-dark"
                                size={"3"}
                              >
                                {collateral_btc} BTC
                              </Text>
                            </Flex>
                          </Box>
                          <Box width={"100%"}>
                            <Flex
                              align={"center"}
                              justify={"between"}
                              gap={"3"}
                            >
                              <Text
                                className={"text-font dark:text-font-dark"}
                                size={"3"}
                                weight={"medium"}
                              >
                                Status:
                              </Text>
                              <Text
                                className="capitalize text-font dark:text-font-dark"
                                size={"3"}
                              >
                                <Badge
                                  color={
                                    contract.status === ContractStatus.Requested
                                      ? "amber"
                                      : contract.status ===
                                          ContractStatus.Approved
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
                            className="bg-btn text-white dark:bg-dark-600 w-full active:scale-90"
                            onClick={() =>
                              navigate(`/my-contracts/${contract.id}`)
                            }
                          >
                            <Text size={"2"} className="font-semibold">
                              {actionFromStatus(contract.status)}
                            </Text>
                          </Button>
                        </Flex>
                      </Box>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Table.Cell>
              )}
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
};
