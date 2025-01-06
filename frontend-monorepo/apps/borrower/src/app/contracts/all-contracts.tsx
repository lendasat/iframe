import { type Contract, ContractStatus } from "@frontend-monorepo/http-client-borrower";
import { usePrice } from "@frontend-monorepo/ui-shared";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Box, Button, Checkbox, DropdownMenu, Flex, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import type {
  ColumnFilter,
  ColumnFilterKey,
  ContractStatusFilter,
  ContractStatusFilterKey,
} from "./contract-details-table";
import { ContractDetailsTable } from "./contract-details-table";

interface OpenContractsProps {
  contracts: Contract[];
}

export const AllContracts = ({ contracts: unfilteredContracts }: OpenContractsProps) => {
  const { latestPrice } = usePrice();

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

  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatusFilter>({
    requested: true,
    renewalRequested: true,
    opening: true,
    open: true,
    undercollateralized: true,
    defaulted: true,
    closed: true,
    closing: true,
    extended: true,
    rejected: false,
    expired: false,
    canceled: false,
    dispute: true,
    approved: true,
    collateralSeen: true,
    repaymentConfirmed: true,
    repaymentProvided: true,
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
    let filtered = false;

    switch (contract.status) {
      case ContractStatus.Requested:
        filtered = contractStatusFilter["requested"];
        break;
      case ContractStatus.RenewalRequested:
        filtered = contractStatusFilter["renewalRequested"];
        break;
      case ContractStatus.Approved:
      case ContractStatus.CollateralSeen:
      case ContractStatus.CollateralConfirmed:
        filtered = contractStatusFilter["opening"];
        break;
      case ContractStatus.PrincipalGiven:
        filtered = contractStatusFilter["open"];
        break;
      case ContractStatus.Undercollateralized:
        filtered = contractStatusFilter["undercollateralized"];
        break;
      case ContractStatus.Defaulted:
        filtered = contractStatusFilter["defaulted"];
        break;
      case ContractStatus.Closing:
      case ContractStatus.RepaymentProvided:
      case ContractStatus.RepaymentConfirmed:
        filtered = contractStatusFilter["closing"];
        break;
      case ContractStatus.Closed:
        filtered = contractStatusFilter["closed"];
        break;
      case ContractStatus.Extended:
        filtered = contractStatusFilter["extended"];
        break;
      case ContractStatus.Rejected:
        filtered = contractStatusFilter["rejected"];
        break;
      case ContractStatus.DisputeBorrowerStarted:
      case ContractStatus.DisputeLenderStarted:
      case ContractStatus.DisputeBorrowerResolved:
      case ContractStatus.DisputeLenderResolved:
        filtered = contractStatusFilter["dispute"];
        break;
      case ContractStatus.Cancelled:
        filtered = contractStatusFilter["canceled"];
        break;
      case ContractStatus.RequestExpired:
        filtered = contractStatusFilter["expired"];
        break;
    }
    return filtered;
  }).sort((a, b) => {
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
                      checked={shownColumns["expiry"]}
                      onCheckedChange={() => toggleFilterOutContractDetails("expiry")}
                    />
                    <Text>Expiry</Text>
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

      <Box className="py-4">
        <ContractDetailsTable
          shownColumns={shownColumns}
          toggleSortByColumn={toggleSortByColumn}
          sortByColumn={sortByColumn}
          sortAsc={sortAsc}
          contractStatusFilter={contractStatusFilter}
          onCheckedChange={toggleContractStatusFilter}
          contracts={contracts}
          latestPrice={latestPrice}
          isToggleFilterShown={true}
        />
      </Box>
    </Box>
  );
};
