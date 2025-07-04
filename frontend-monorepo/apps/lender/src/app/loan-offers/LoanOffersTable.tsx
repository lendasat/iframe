import { LoanOffer } from "@frontend/http-client-lender";
import { formatCurrency, KycBadge, LoanAssetHelper } from "@frontend/ui-shared";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Box, Button, Callout, Flex, Table, Text } from "@radix-ui/themes";
import { useState } from "react";
import { IoCaretDownOutline, IoCaretUp } from "react-icons/io5";
import { Lender } from "./lender";

export type ColumnFilterKey =
  | "lender"
  | "amount"
  | "duration"
  | "interest"
  | "ltv"
  | "coin"
  | "requirements"
  | "createdAt";

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
          className={`-mb-1 text-[10px] ${getCaretColor(
            sortByColumn,
            currentColumn,
            sortAsc,
          )}`}
        />
        <IoCaretDownOutline
          className={`-mb-1 text-[10px] ${getCaretColor(
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
  offers: LoanOffer[];
}

export const LoanOffersTable = ({ offers }: ContractDetailsTableProps) => {
  const [sortByColumn, setSortByColumn] =
    useState<ColumnFilterKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSortByColumn(column: ColumnFilterKey) {
    setSortByColumn(column);
    setSortAsc(!sortAsc);
  }

  const sortedOffers = offers.sort((a, b) => {
    let sorted = 0;
    switch (sortByColumn) {
      case "lender":
        sorted = a.lender.id.localeCompare(b.lender.id);
        break;
      case "amount":
        sorted = a.loan_amount_min - b.loan_amount_min;
        break;
      case "duration":
        sorted = a.duration_days_min - b.duration_days_min;
        break;
      case "interest":
        sorted = a.interest_rate - b.interest_rate;
        break;
      case "ltv":
        sorted = a.min_ltv - b.min_ltv;
        break;
      case "coin":
        sorted = a.loan_asset.localeCompare(b.loan_asset);
        break;
      case "requirements":
        sorted = a.kyc_link ? 1 : -1;
        break;
      case "createdAt":
        sorted = a.created_at.getTime() - b.created_at.getTime();
        break;
    }

    if (sortAsc) {
      return sorted;
    } else {
      return -sorted;
    }
  });

  return (
    <Table.Root variant="surface" size={"2"} layout={"auto"}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <ColumnHeader
              toggleSortByColumn={toggleSortByColumn}
              sortByColumn={sortByColumn}
              sortAsc={sortAsc}
              currentColumn={"lender"}
              label={"Lender"}
            />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <ColumnHeader
              toggleSortByColumn={toggleSortByColumn}
              sortByColumn={sortByColumn}
              sortAsc={sortAsc}
              currentColumn={"amount"}
              label={"Amount"}
            />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <Box className="hidden md:flex">
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn={"duration"}
                label={"Duration"}
              />
            </Box>
          </Table.ColumnHeaderCell>
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
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <ColumnHeader
              toggleSortByColumn={toggleSortByColumn}
              sortByColumn={sortByColumn}
              sortAsc={sortAsc}
              currentColumn={"ltv"}
              label={"LTV"}
            />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <Box className={"hidden md:flex"}>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn={"coin"}
                label={"Coin"}
              />
            </Box>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <Box className="hidden md:flex">
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn={"requirements"}
                label={"Requirements"}
              />
            </Box>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={"text-font dark:text-font-dark"}>
            <Box className={"hidden md:flex"}>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn={"createdAt"}
                label={"CreatedAt"}
              />
            </Box>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {sortedOffers.length === 0 ? (
          <Table.Row key={"empty"}>
            <Table.Cell colSpan={8}>
              <Callout.Root color={"blue"}>
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>No contracts found.</Callout.Text>
              </Callout.Root>
            </Table.Cell>
          </Table.Row>
        ) : (
          sortedOffers.map((offer) => {
            const loanAsset = offer.loan_asset;

            return (
              <Table.Row key={offer.id}>
                <Table.RowHeaderCell>
                  <Lender {...offer.lender} showAvatar={true} />
                </Table.RowHeaderCell>
                <Table.RowHeaderCell>
                  <Text
                    className={"text-font dark:text-font-dark"}
                    size={"1"}
                    weight={"medium"}
                  >
                    {formatCurrency(
                      offer.loan_amount_min,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                    -{" "}
                    {formatCurrency(
                      offer.loan_amount_max,
                      LoanAssetHelper.toCurrency(offer.loan_asset),
                    )}
                  </Text>
                </Table.RowHeaderCell>
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {offer.duration_days_min} - {offer.duration_days_max}
                    </Text>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {(offer.interest_rate * 100).toFixed(2)}%
                    </Text>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {(offer.min_ltv * 100).toFixed(2)}%
                    </Text>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {LoanAssetHelper.print(loanAsset)}
                    </Text>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {offer.kyc_link && <KycBadge />}
                    </Text>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Box className="hidden md:flex">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    >
                      {offer.created_at.toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </Box>
                </Table.Cell>
              </Table.Row>
            );
          })
        )}
      </Table.Body>
    </Table.Root>
  );
};
