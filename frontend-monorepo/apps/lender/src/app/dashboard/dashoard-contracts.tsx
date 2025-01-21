import { ContractStatus } from "@frontend-monorepo/http-client-lender";
import type { Contract } from "@frontend-monorepo/http-client-lender";
import { usePrice } from "@frontend-monorepo/ui-shared";
import { Box, Heading, Tabs, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { ColumnFilterKey } from "../contracts/contract-details-table";
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

const filterContracts = (unfilteredContracts: Contract[], contractStatusFilter: ContractStatus[]) => {
  return unfilteredContracts.filter((contract) => {
    return contractStatusFilter.includes(contract.status);
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

  const statusFilterActionRequired = [
    ContractStatus.Requested,
    ContractStatus.RenewalRequested,
    ContractStatus.CollateralSeen,
    ContractStatus.CollateralConfirmed,
    ContractStatus.RepaymentProvided,
    ContractStatus.Defaulted,
    ContractStatus.Undercollateralized,
    ContractStatus.DisputeBorrowerStarted,
    ContractStatus.DisputeLenderStarted,
  ];

  const statusFilterOpen = [
    ContractStatus.Approved,
    ContractStatus.PrincipalGiven,
  ];
  const statusFilterClosed = [
    ContractStatus.Closing,
    ContractStatus.Closed,
    ContractStatus.Extended,
  ];

  const contractsWithActionNeeded = contracts.filter((loan) =>
    loan.status === ContractStatus.Requested || loan.status === ContractStatus.RenewalRequested
    || loan.status === ContractStatus.Defaulted || loan.status === ContractStatus.CollateralSeen
    || loan.status === ContractStatus.CollateralConfirmed
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
              contracts={filterContracts(contracts, statusFilterActionRequired)}
              latestPrice={latestPrice}
              shownColumns={shownColumns}
              sortAsc={sortAsc}
              sortByColumn={sortByColumn}
              toggleSortByColumn={toggleSortByColumn}
            />
          </Tabs.Content>
          <Tabs.Content value="open">
            <ContractDetailsTable
              contracts={filterContracts(contracts, statusFilterOpen)}
              latestPrice={latestPrice}
              shownColumns={shownColumns}
              sortAsc={sortAsc}
              sortByColumn={sortByColumn}
              toggleSortByColumn={toggleSortByColumn}
            />
          </Tabs.Content>

          <Tabs.Content value="closed">
            <ContractDetailsTable
              contracts={filterContracts(contracts, statusFilterClosed)}
              latestPrice={latestPrice}
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
