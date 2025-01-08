import { ContractStatus } from "@frontend-monorepo/http-client-lender";
import type { Contract } from "@frontend-monorepo/http-client-lender";
import { usePrice } from "@frontend-monorepo/ui-shared";
import { Box, Heading, Tabs, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { ColumnFilterKey, ContractStatusFilter } from "../contracts/contract-details-table";
import { ContractDetailsTable } from "../contracts/contract-details-table";

interface TabHeaderProps {
  thisIndex: string;
  label: string;
  needsAction?: boolean;
}

export function TabHeader({ thisIndex, label, needsAction }: TabHeaderProps) {
  return (
    <Tabs.Trigger
      className={`text-[13px] font-medium px-6 max-h-9 rounded-lg bg-transparent text-font/60 dark:text-font-dark/60"
      data-[state=active]:bg-purple-800
      data-[state=active]:text-white
      data-[state=inactive]:dark:text-gray-400
      data-[state=active]:dark:text-white
      ${needsAction ? "animate-pulse bg-red-100 dark:bg-red-900/30" : ""}
      }`}
      value={thisIndex}
    >
      <Text
        size={"2"}
        weight={"medium"}
        className={`break-all`}
      >
        {needsAction && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75">
            </span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
        {label}
      </Text>
    </Tabs.Trigger>
  );
}

export interface DashboardContractsProps {
  contracts: Contract[];
}

const filterContracts = (unfilteredContracts: Contract[], contractStatusFilter: ContractStatusFilter) => {
  return unfilteredContracts.filter((contract) => {
    let filtered = false;
    switch (contract.status) {
      case ContractStatus.Requested:
        filtered = contractStatusFilter["requested"];
        break;
      case ContractStatus.RenewalRequested:
        filtered = contractStatusFilter["renewalRequested"];
        break;
      case ContractStatus.Approved:
        filtered = contractStatusFilter["approved"];
        break;
      case ContractStatus.CollateralSeen:
        filtered = contractStatusFilter["collateralSeen"];
        break;
      case ContractStatus.CollateralConfirmed:
        filtered = contractStatusFilter["opening"];
        break;
      case ContractStatus.PrincipalGiven:
        filtered = contractStatusFilter["open"];
        break;
      case ContractStatus.Closing:
        filtered = contractStatusFilter["closing"];
        break;
      case ContractStatus.RepaymentProvided:
        filtered = contractStatusFilter["repaymentProvided"];
        break;
      case ContractStatus.RepaymentConfirmed:
        filtered = contractStatusFilter["repaymentConfirmed"];
        break;
      case ContractStatus.Undercollateralized:
        filtered = contractStatusFilter["undercollateralized"];
        break;
      case ContractStatus.Defaulted:
        filtered = contractStatusFilter["defaulted"];
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
  });
};

export default function DashboardContracts({ contracts }: DashboardContractsProps) {
  const { latestPrice } = usePrice();

  const [sortByColumn, setSortByColumn] = useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSortByColumn(column: ColumnFilterKey) {
    setSortByColumn(column);
    setSortAsc(!sortAsc);
  }

  const shownColumns = {
    updatedAt: true,
    amount: true,
    expiry: true,
    interest: true,
    ltv: true,
    collateral: true,
    status: true,
    action: true,
  };

  const allStatusFalse = {
    requested: false,
    renewalRequested: false,
    approved: false,
    collateralSeen: false,
    opening: false,
    open: false,
    closing: false,
    closed: false,
    extended: false,
    repaymentProvided: false,
    repaymentConfirmed: false,
    rejected: false,
    expired: false,
    canceled: false,
    dispute: false,
    defaulted: false,
    undercollateralized: false,
  };

  const statusFilterActionRequired = {
    ...allStatusFalse,
    requested: true,
    renewalRequested: true,
    opening: true,
    collateralSeen: true,
    repaymentProvided: true,
    dispute: true,
    undercollateralized: true,
  };

  const statusFilterOpen = {
    ...allStatusFalse,
    open: true,
  };
  const statusFilterClosed = {
    ...allStatusFalse,
    closing: true,
    closed: true,
    extended: true,
  };

  const contractsWithActionNeeded = contracts.filter((loan) =>
    loan.status === ContractStatus.Requested || loan.status === ContractStatus.RenewalRequested
    || loan.status === ContractStatus.Defaulted || loan.status === ContractStatus.CollateralConfirmed
    || loan.status === ContractStatus.RepaymentProvided
  );
  const needsAction = contractsWithActionNeeded.length > 0;

  return (
    <Box className="space-y-3">
      <Tabs.Root defaultValue={!needsAction ? "actionRequired" : "open"} className={"flex flex-col"}>
        <Box className="space-y-2 flex items-center justify-between flex-wrap">
          <Heading className="text-black dark:text-white">
            Contracts
          </Heading>
          <Tabs.List
            className="bg-white dark:bg-dark-500 flex items-center gap-1 p-1 rounded-xl border dark:border-dark-600 shrink-0 "
            color={undefined}
          >
            <TabHeader needsAction={needsAction} thisIndex={"actionRequired"} label={"Action Required"} />
            <TabHeader thisIndex={"open"} label={"Open"} />
            <TabHeader thisIndex={"closed"} label={"Closed"} />
          </Tabs.List>
        </Box>

        <Box className="max-h-96 overflow-auto">
          <Tabs.Content value={"actionRequired"}>
            <ContractDetailsTable
              contractStatusFilter={statusFilterActionRequired}
              contracts={filterContracts(contracts, statusFilterActionRequired)}
              isToggleFilterShown={false}
              latestPrice={latestPrice}
              onCheckedChange={() => {
                // ignored
              }}
              shownColumns={shownColumns}
              sortAsc={sortAsc}
              sortByColumn={sortByColumn}
              toggleSortByColumn={toggleSortByColumn}
            />
          </Tabs.Content>
          <Tabs.Content value="open">
            <ContractDetailsTable
              contractStatusFilter={statusFilterOpen}
              contracts={filterContracts(contracts, statusFilterOpen)}
              isToggleFilterShown={false}
              latestPrice={latestPrice}
              onCheckedChange={() => {
                // ignored
              }}
              shownColumns={shownColumns}
              sortAsc={sortAsc}
              sortByColumn={sortByColumn}
              toggleSortByColumn={toggleSortByColumn}
            />
          </Tabs.Content>

          <Tabs.Content value="closed">
            <ContractDetailsTable
              contractStatusFilter={statusFilterClosed}
              contracts={filterContracts(contracts, statusFilterClosed)}
              isToggleFilterShown={false}
              latestPrice={latestPrice}
              onCheckedChange={() => {
                // ignored
              }}
              shownColumns={shownColumns}
              sortAsc={sortAsc}
              sortByColumn={sortByColumn}
              toggleSortByColumn={toggleSortByColumn}
            />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}
