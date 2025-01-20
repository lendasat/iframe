import {
  ALL_CONTRACT_STATUSES,
  ContractStatus,
  contractStatusToLabelString,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import { usePrice } from "@frontend-monorepo/ui-shared";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import * as Label from "@radix-ui/react-label";
import { Box, Button, Checkbox, DropdownMenu, Flex, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import { useAsync } from "react-use";
import { ColumnFilter, ColumnFilterKey, ContractDetailsTable } from "../contracts/contract-details-table";
import { LoanOffersTable } from "./LoanOffersTable";

export const LoanOffersOverview = () => {
  let { getAllLoanOffers } = useLenderHttpClient();

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

  const { value } = useAsync(async () => {
    return getAllLoanOffers();
  });

  // TODO: error handling and loading handling

  const loanOffers = value || [];

  return (
    <Box className={"pb-20"}>
      <Box className={"px-6 md:px-8 py-4"}>
        <Flex gap={"1"} align={"center"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>Available Loan Offers</Heading>
        </Flex>
      </Box>

      <Box className={"px-6 md:px-8 py-4"}>
        <LoanOffersTable offers={loanOffers} />
      </Box>
    </Box>
  );
};
