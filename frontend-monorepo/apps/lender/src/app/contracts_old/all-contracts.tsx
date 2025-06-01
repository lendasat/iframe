import {
  type Contract,
  isContractClosed,
  isContractOpen,
} from "@frontend/http-client-lender";
import { usePrice } from "@frontend/ui-shared";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import * as Label from "@radix-ui/react-label";
import {
  Box,
  Button,
  Checkbox,
  DropdownMenu,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { ContractDetailsTable } from "./contract-details-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";

type ColumnFilterKey =
  | "updatedAt"
  | "amount"
  | "expiry"
  | "interest"
  | "ltv"
  | "collateral"
  | "status"
  | "action";
type ColumnFilter = Record<ColumnFilterKey, boolean>;

enum ContractStatusFilterType {
  All = "All",
  Open = "Open",
  Closed = "Closed",
}

interface OpenContractsProps {
  contracts: Contract[];
  header?: boolean;
}

export const AllContracts = ({
  contracts: unfilteredContracts,
  header,
}: OpenContractsProps) => {
  const { latestPrice } = usePrice();
  const [contractStatusFilter, setContractStatusFilter] = useState(
    ContractStatusFilterType.Open,
  );

  const [shownColumns, setShownColumns] = useState<ColumnFilter>({
    updatedAt: true,
    amount: true,
    expiry: true,
    interest: true,
    ltv: true,
    collateral: true,
    status: true,
    action: true,
  });

  const [sortByColumn, setSortByColumn] =
    useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleFilterOutContractDetails = (filterName: ColumnFilterKey) => {
    setShownColumns((prev) => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };

  const contracts = unfilteredContracts
    .filter((contract) => {
      switch (contractStatusFilter) {
        case ContractStatusFilterType.Open:
          return isContractOpen(contract.status);
        case ContractStatusFilterType.Closed:
          return isContractClosed(contract.status);
        case ContractStatusFilterType.All:
          return true;
      }
    })
    .sort((a, b) => {
      // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
      let dif;
      switch (sortByColumn) {
        case "updatedAt":
          dif = a.updated_at.getTime() - b.updated_at.getTime();
          break;
        case "amount":
          dif = a.loan_amount - b.loan_amount;
          break;
        case "expiry":
          dif = a.expiry.getTime() - b.expiry.getTime();
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

  const handleContractStatusFilterChange = (value: string) => {
    switch (value) {
      case "Open":
        setContractStatusFilter(ContractStatusFilterType.Open);
        break;
      case "Closed":
        setContractStatusFilter(ContractStatusFilterType.Closed);
        break;
      case "All":
        setContractStatusFilter(ContractStatusFilterType.All);
        break;
    }
  };

  return (
    <Box className={"pb-20"}>
      <Box className={header ? "hidden" : "px-6 py-4 md:px-8"}>
        <Flex gap={"1"} align={"center"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>
            My Contracts
          </Heading>
        </Flex>

        <div className="mt-5 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <Label.Root
              className="text-font dark:text-font-dark text-sm font-medium text-gray-700"
              htmlFor="fields-switch"
            >
              Show/hide Fields
            </Label.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="outline" size="2">
                  <MixerHorizontalIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                className={"bg-light dark:bg-dark"}
                size="1"
              >
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns.amount}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("amount")
                      }
                    />
                    <Text className={"text-font dark:text-font-dark"}>
                      Amount
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns.expiry}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("expiry")
                      }
                    />
                    <Text className={"text-font dark:text-font-dark"}>
                      Expiry
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns.interest}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("interest")
                      }
                    />
                    <Text className={"text-font dark:text-font-dark"}>
                      Interest
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns.ltv}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("ltv")
                      }
                    />
                    <Text className={"text-font dark:text-font-dark"}>LTV</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns.collateral}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("collateral")
                      }
                    />
                    <Text className={"text-font dark:text-font-dark"}>
                      Collateral
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns.status}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("status")
                      }
                    />
                    <Text className={"text-font dark:text-font-dark"}>
                      Status
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>

          <div className="flex items-center justify-between">
            <Flex className={"flex items-center justify-between"} gap={"4"}>
              <Label.Root
                className="text-font dark:text-font-dark text-sm font-medium text-gray-700"
                htmlFor="contracts-switch"
              >
                Show/hide Contracts
              </Label.Root>
              <Text
                className={"text-font dark:text-font-dark"}
                size={"1"}
                weight={"medium"}
              >
                ({contracts.length}/{unfilteredContracts.length} displayed)
              </Text>
            </Flex>
            <Select
              value={contractStatusFilter}
              onValueChange={(newVal) => {
                handleContractStatusFilterChange(newVal);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Contracts" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Box>

      <Box className={header ? "" : "px-6 py-4 md:px-8"}>
        <ContractDetailsTable
          shownColumns={shownColumns}
          toggleSortByColumn={toggleSortByColumn}
          sortByColumn={sortByColumn}
          sortAsc={sortAsc}
          contracts={contracts}
          latestPrice={latestPrice}
        />
      </Box>
    </Box>
  );
};
