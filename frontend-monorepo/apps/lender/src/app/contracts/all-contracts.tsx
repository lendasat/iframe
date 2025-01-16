import { type Contract, ContractStatus } from "@frontend-monorepo/http-client-lender";
import { usePrice } from "@frontend-monorepo/ui-shared";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import * as Label from "@radix-ui/react-label";
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

  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatus[]>([
    ContractStatus.Requested,
    ContractStatus.RenewalRequested,
    ContractStatus.Approved,
    ContractStatus.Approved,
    ContractStatus.CollateralSeen,
    ContractStatus.CollateralConfirmed,
    ContractStatus.PrincipalGiven,
    ContractStatus.RepaymentProvided,
    ContractStatus.DisputeBorrowerStarted,
    ContractStatus.DisputeBorrowerResolved,
    ContractStatus.DisputeLenderStarted,
    ContractStatus.DisputeLenderResolved,
    ContractStatus.Defaulted,
    ContractStatus.Undercollateralized,
  ]);

  const [sortByColumn, setSortByColumn] = useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleFilterOutContractDetails = (filterName: ColumnFilterKey) => {
    setShownColumns(prev => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };
  const toggleContractStatusFilter = (filterName: ContractStatus) => {
    setContractStatusFilter(prev =>
      prev.includes(filterName)
        ? prev.filter(status => status !== filterName)
        : [...prev, filterName]
    );
  };

  const contracts = unfilteredContracts.filter((contract) => {
    return contractStatusFilter.includes(contract.status);
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
        </Flex>

        <div className="w-full max-w-md space-y-4 mt-5">
          <div className="flex items-center justify-between">
            <Label.Root className="text-sm font-medium text-gray-700" htmlFor="fields-switch">
              Show/hide Fields
            </Label.Root>
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
          </div>

          <div className="flex items-center justify-between">
            <Flex className={"flex items-center justify-between"} gap={"4"}>
              <Label.Root className="text-sm font-medium text-gray-700" htmlFor="contracts-switch">
                Show/hide Contracts
              </Label.Root>
              <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
                ({contracts.length}/{unfilteredContracts.length} displayed)
              </Text>
            </Flex>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant={"outline"} size="2">
                  <MixerHorizontalIcon />
                </Button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content size="1">
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Requested)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.Requested)}
                    />
                    <Text>Requested</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Approved)
                        || contractStatusFilter.includes(ContractStatus.CollateralSeen)
                        || contractStatusFilter.includes(ContractStatus.CollateralConfirmed)}
                      onCheckedChange={() => {
                        toggleContractStatusFilter(ContractStatus.Approved);
                        toggleContractStatusFilter(ContractStatus.CollateralSeen);
                        toggleContractStatusFilter(ContractStatus.CollateralConfirmed);
                      }}
                    />
                    <Text>Opening</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.PrincipalGiven)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.PrincipalGiven)}
                    />
                    <Text>Open</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.RepaymentProvided)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.RepaymentProvided)}
                    />
                    <Text>Repayment provided</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Closing)
                        || contractStatusFilter.includes(ContractStatus.RepaymentConfirmed)}
                      onCheckedChange={() => {
                        toggleContractStatusFilter(ContractStatus.Closing);
                        toggleContractStatusFilter(ContractStatus.RepaymentConfirmed);
                      }}
                    />
                    <Text>Closing</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Closed)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.Closed)}
                    />
                    <Text>Closed</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Rejected)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.Rejected)}
                    />
                    <Text>Rejected</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.RequestExpired)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.RequestExpired)}
                    />
                    <Text>Expired</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Cancelled)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.Cancelled)}
                    />
                    <Text>Canceled</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Extended)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.Extended)}
                    />
                    <Text>Extended</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.Defaulted)}
                      onCheckedChange={() => toggleContractStatusFilter(ContractStatus.Defaulted)}
                    />
                    <Text>Defaulted</Text>
                  </Flex>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onSelect={(e) => e.preventDefault()}
                >
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={contractStatusFilter.includes(ContractStatus.DisputeBorrowerStarted)
                        || contractStatusFilter.includes(ContractStatus.DisputeLenderStarted)
                        || contractStatusFilter.includes(ContractStatus.DisputeBorrowerResolved)
                        || contractStatusFilter.includes(ContractStatus.DisputeLenderResolved)}
                      onCheckedChange={() => {
                        toggleContractStatusFilter(ContractStatus.DisputeBorrowerStarted);
                        toggleContractStatusFilter(ContractStatus.DisputeLenderStarted);
                        toggleContractStatusFilter(ContractStatus.DisputeBorrowerResolved);
                        toggleContractStatusFilter(ContractStatus.DisputeLenderResolved);
                      }}
                    />
                    <Text>Disputes</Text>
                  </Flex>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
      </Box>

      <Box className={header ? "" : "px-6 md:px-8 py-4"}>
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
