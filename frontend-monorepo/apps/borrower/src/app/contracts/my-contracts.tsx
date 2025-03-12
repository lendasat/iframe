import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import {
  ContractStatus,
  contractStatusToLabelString,
} from "@frontend/http-client-borrower";
import { ALL_CONTRACT_STATUSES } from "@frontend/http-client-lender";
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
import { Link } from "react-router-dom";
import { useAsync } from "react-use";
import {
  ColumnFilter,
  ColumnFilterKey,
  ContractDetailsTable,
} from "./contract-details-table";

function MyContracts() {
  const { getContracts } = useBorrowerHttpClient();

  const { value, error } = useAsync(async () => {
    return getContracts();
  });

  // TODO: handle error properly
  if (error) {
    console.error(`Failed loading contracts ${JSON.stringify(error)}`);
  }

  const unfilteredContracts = value || [];

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

  const [contractStatusFilter, setContractStatusFilter] = useState<
    ContractStatus[]
  >([
    ContractStatus.Requested,
    ContractStatus.RenewalRequested,
    ContractStatus.Approved,
    ContractStatus.Approved,
    ContractStatus.CollateralSeen,
    ContractStatus.CollateralConfirmed,
    ContractStatus.PrincipalGiven,
    ContractStatus.RepaymentProvided,
    ContractStatus.RepaymentConfirmed,
    ContractStatus.DisputeBorrowerStarted,
    ContractStatus.DisputeBorrowerResolved,
    ContractStatus.DisputeLenderStarted,
    ContractStatus.DisputeLenderResolved,
    ContractStatus.Defaulted,
    ContractStatus.Undercollateralized,
  ]);
  const [sortByColumn, setSortByColumn] =
    useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleFilterOutContractDetails = (filterName: ColumnFilterKey) => {
    setShownColumns((prev) => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };
  const toggleContractStatusFilter = (filterName: ContractStatus) => {
    setContractStatusFilter((prev) =>
      prev.includes(filterName)
        ? prev.filter((status) => status !== filterName)
        : [...prev, filterName],
    );
  };

  function toggleSortByColumn(column: ColumnFilterKey) {
    setSortByColumn(column);
    setSortAsc(!sortAsc);
  }

  const contracts = unfilteredContracts
    .filter((contract) => {
      return contractStatusFilter.includes(contract.status);
    })
    .sort((a, b) => {
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

  if (contracts.length === 0) {
    return (
      <p className={"text-font dark:text-font-dark"}>
        You do not have any contracts yet.
      </p>
    );
  }

  return (
    <Box className={"pb-20"}>
      <Box className={"px-6 py-4 md:px-8"}>
        <Flex align={"center"} justify={"between"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>
            My Contracts
          </Heading>
          <Button asChild color="purple" className="text-sm" size={"3"}>
            <Link to={"/requests"}>New Request</Link>
          </Button>
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
                size="1"
                className={"bg-light dark:bg-dark"}
              >
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["amount"]}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("amount")
                      }
                    />
                    <Text className="text-font dark:text-font-dark">
                      Amount
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["expiry"]}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("expiry")
                      }
                    />
                    <Text className="text-font dark:text-font-dark">
                      Expiry
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["interest"]}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("interest")
                      }
                    />
                    <Text className="text-font dark:text-font-dark">
                      Interest
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["ltv"]}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("ltv")
                      }
                    />
                    <Text className="text-font dark:text-font-dark">LTV</Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["collateral"]}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("collateral")
                      }
                    />
                    <Text className="text-font dark:text-font-dark">
                      Collateral
                    </Text>
                  </Flex>
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <Flex gap="2" align="center">
                    <Checkbox
                      checked={shownColumns["status"]}
                      onCheckedChange={() =>
                        toggleFilterOutContractDetails("status")
                      }
                    />
                    <Text className="text-font dark:text-font-dark">
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
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant={"outline"} size="2">
                  <MixerHorizontalIcon />
                </Button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content
                className={"bg-light dark:bg-dark"}
                size="1"
              >
                {ALL_CONTRACT_STATUSES.map((contractStatus) => {
                  return (
                    <DropdownMenu.Item
                      onSelect={(e) => e.preventDefault()}
                      key={contractStatus.toLowerCase()}
                    >
                      <Flex gap="2" align="center">
                        <Checkbox
                          checked={contractStatusFilter.includes(
                            contractStatus,
                          )}
                          onCheckedChange={() =>
                            toggleContractStatusFilter(contractStatus)
                          }
                        />
                        <Text className="text-font dark:text-font-dark">
                          {contractStatusToLabelString(contractStatus)}
                        </Text>
                      </Flex>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
      </Box>

      <Box className={"px-6 py-4 md:px-8"}>
        <ContractDetailsTable
          shownColumns={shownColumns}
          toggleSortByColumn={toggleSortByColumn}
          sortByColumn={sortByColumn}
          sortAsc={sortAsc}
          contracts={contracts}
        />
      </Box>
    </Box>
  );
}

export default MyContracts;
