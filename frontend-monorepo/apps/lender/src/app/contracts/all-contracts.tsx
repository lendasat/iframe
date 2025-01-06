import { ContractStatus } from "@frontend-monorepo/http-client-lender";
import { type Contract } from "@frontend-monorepo/http-client-lender";
import { usePrice } from "@frontend-monorepo/ui-shared";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Box, Button, Checkbox, DropdownMenu, Flex, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import { ContractDetailsTable } from "./contract-details-table";

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

type ContractStatusFilterKey =
  | "requested"
  | "renewalRequested"
  | "approved"
  | "opening"
  | "open"
  | "closing"
  | "closed"
  | "extended"
  | "rejected"
  | "expired"
  | "canceled"
  | "collateralSeen"
  | "repaymentProvided"
  | "repaymentConfirmed"
  | "dispute"
  | "defaulted"
  | "undercollateralized";

type ContractStatusFilter = Record<ContractStatusFilterKey, boolean>;

interface OpenContractsProps {
  contracts: Contract[];
  header?: boolean;
}

export const AllContracts = ({ contracts: unfilteredContracts, header }: OpenContractsProps) => {
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
    approved: true,
    opening: true,
    open: true,
    closing: false,
    closed: false,
    extended: false,
    rejected: false,
    expired: false,
    canceled: false,
    collateralSeen: false,
    repaymentProvided: true,
    repaymentConfirmed: false,
    dispute: true,
    defaulted: true,
    undercollateralized: true,
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
      case ContractStatus.RepaymentProvided:
        filtered = contractStatusFilter["repaymentProvided"];
        break;
      case ContractStatus.Closing:
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
      case ContractStatus.Defaulted:
        filtered = contractStatusFilter["defaulted"];
        break;
      case ContractStatus.Undercollateralized:
        filtered = contractStatusFilter["undercollateralized"];
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
      <Box className={header ? "hidden" : "px-6 md:px-8 py-4"}>
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

      <Box className={header ? "" : "px-6 md:px-8 py-4"}>
        <ContractDetailsTable
          shownColumns={shownColumns}
          toggleSortByColumn={toggleSortByColumn}
          sortByColumn={sortByColumn}
          sortAsc={sortAsc}
          contractStatusFilter={contractStatusFilter}
          onCheckedChange={(checked) => {
            toggleContractStatusFilter(checked);
          }}
          contracts={contracts}
          latestPrice={latestPrice}
          isToggleFilterShown={true}
        />
      </Box>
    </Box>
  );
};
