import { ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency, usePrice } from "@frontend-monorepo/ui-shared";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { Box, Button, Grid, Heading, Skeleton, Tabs, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { HTMLAttributeAnchorTarget } from "react";
import type { IconType } from "react-icons";
import { BsBank, BsTicketPerforatedFill } from "react-icons/bs";
import { IoWalletOutline } from "react-icons/io5";
import { RiCustomerService2Fill } from "react-icons/ri";
import { Link, useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import type { ColumnFilter, ColumnFilterKey, ContractStatusFilter } from "../contracts/contract-details-table";
import { ContractDetailsTable } from "../contracts/contract-details-table";

interface ContractOverviewProps {
  contracts: Contract[];
  contractStatusFilter: ContractStatusFilter;
}

const ContractOverview = ({ contracts: unfilteredContracts, contractStatusFilter }: ContractOverviewProps) => {
  const { latestPrice } = usePrice();

  const shownColumns: ColumnFilter = {
    updatedAt: true,
    amount: true,
    expiry: true,
    interest: true,
    ltv: true,
    collateral: true,
    status: true,
    action: true,
  };

  const [sortByColumn, setSortByColumn] = useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const contracts = unfilteredContracts.filter((contract) => {
    let filterStatus = false;
    switch (contract.status) {
      case ContractStatus.Requested:
        filterStatus = contractStatusFilter["requested"];
        break;
      case ContractStatus.RenewalRequested:
        filterStatus = contractStatusFilter["renewalRequested"];
        break;
      case ContractStatus.Approved:
        filterStatus = contractStatusFilter["approved"];
        break;
      case ContractStatus.CollateralSeen:
        filterStatus = contractStatusFilter["collateralSeen"];
        break;
      case ContractStatus.CollateralConfirmed:
        filterStatus = contractStatusFilter["opening"];
        break;
      case ContractStatus.PrincipalGiven:
        filterStatus = contractStatusFilter["open"];
        break;
      case ContractStatus.Undercollateralized:
        filterStatus = contractStatusFilter["undercollateralized"];
        break;
      case ContractStatus.Defaulted:
        filterStatus = contractStatusFilter["defaulted"];
        break;
      case ContractStatus.Closing:
        filterStatus = contractStatusFilter["closing"];
        break;
      case ContractStatus.RepaymentProvided:
        filterStatus = contractStatusFilter["repaymentProvided"];
        break;
      case ContractStatus.RepaymentConfirmed:
        filterStatus = contractStatusFilter["repaymentConfirmed"];
        break;
      case ContractStatus.Closed:
        filterStatus = contractStatusFilter["closed"];
        break;
      case ContractStatus.Extended:
        filterStatus = contractStatusFilter["extended"];
        break;
      case ContractStatus.Rejected:
        filterStatus = contractStatusFilter["rejected"];
        break;
      case ContractStatus.DisputeBorrowerStarted:
      case ContractStatus.DisputeLenderStarted:
      case ContractStatus.DisputeBorrowerResolved:
      case ContractStatus.DisputeLenderResolved:
        filterStatus = contractStatusFilter["dispute"];
        break;
      case ContractStatus.Cancelled:
        filterStatus = contractStatusFilter["canceled"];
        break;
      case ContractStatus.RequestExpired:
        filterStatus = contractStatusFilter["expired"];
        break;
    }
    return filterStatus;
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
    <Box className="py-4">
      <ContractDetailsTable
        shownColumns={shownColumns}
        toggleSortByColumn={toggleSortByColumn}
        sortByColumn={sortByColumn}
        sortAsc={sortAsc}
        contractStatusFilter={contractStatusFilter}
        onCheckedChange={() => {
          // ignored
        }}
        contracts={contracts}
        latestPrice={latestPrice}
        isToggleFilterShown={false}
      />
    </Box>
  );
};

function DashBoard() {
  const { innerHeight } = window;
  const { getContracts } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const { loading, value: maybeContracts } = useAsync(async () => {
    return await getContracts();
  }, []);

  const contracts = maybeContracts || [];

  const totalLoanAmount = contracts
    ? contracts
      .filter((loan) => loan.status === ContractStatus.PrincipalGiven)
      .map((loan) => loan.loan_amount)
      .reduce((sum, amount) => sum + amount, 0)
    : 0;

  // All the loans that were at least approved by the lender.
  const totalLoans = contracts?.filter((loan) =>
    loan.status !== ContractStatus.Rejected && loan.status !== ContractStatus.RequestExpired
    && loan.status !== ContractStatus.Cancelled
  ).length;

  const totalActiveLoans =
    contracts.filter((loan) =>
      loan.status !== ContractStatus.Requested && loan.status !== ContractStatus.Approved
      && loan.status !== ContractStatus.CollateralSeen && loan.status !== ContractStatus.Rejected
      && loan.status !== ContractStatus.RequestExpired && loan.status !== ContractStatus.Cancelled
      && loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Closing
    ).length;

  const contractsWithActionNeeded = contracts.filter((loan) =>
    loan.status === ContractStatus.Approved
    || loan.status === ContractStatus.RepaymentConfirmed
  );
  const needsAction = contractsWithActionNeeded.length > 0;

  return (
    <Box
      className="flex flex-col overflow-y-scroll p-4 dark:bg-dark"
      height={innerHeight - 120 + "px"}
    >
      <Grid
        className="w-full"
        columns={{
          initial: "1",
          sm: "3",
          md: "3",
          lg: "3",
          xl: "3",
        }}
        gapX="4"
        gapY="4"
      >
        <Box
          id="summary"
          gridColumnStart={{
            initial: "1",
          }}
          className="bg-white dark:bg-dark-700 rounded-2xl p-5 min-h-72 h-full"
        >
          <Text as="p" weight={"medium"} className="text-font dark:text-font-dark" size={"3"}>Open Contracts</Text>
          {/*Total Loan Received*/}
          <Heading size={"8"} mt={"3"} className="text-font dark:text-font-dark">
            {loading ? <Skeleton>$756,809.32</Skeleton> : formatCurrency(totalLoanAmount)}
          </Heading>

          <Grid
            columns={{ initial: "1", md: "2" }}
            gap={"3"}
            className="col-span-2 mt-8"
          >
            <Box className="border border-font/10 dark:border-font-dark/20 rounded-xl py-2 px-3">
              {/*Total number of loans received*/}
              <Heading className="text-font dark:text-font-dark" size={"6"}>
                {loading ? <Skeleton>6</Skeleton> : totalLoans}
              </Heading>
              <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">All Contracts</Text>
            </Box>

            <Box className="border border-font/10 dark:border-font-dark/20 rounded-xl py-2 px-3">
              {/*Total number of loans not repaid/closed */}
              <Heading className="text-font dark:text-font-dark" size={"6"}>
                {loading ? <Skeleton>2</Skeleton> : totalActiveLoans}
              </Heading>
              <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">Open Contracts</Text>
            </Box>
          </Grid>
        </Box>

        <Box
          id="quick_actions"
          gridColumnStart={{
            initial: "1",
            sm: "2",
          }}
          gridColumnEnd={{
            initial: "2",
            sm: "4",
          }}
          className="bg-white dark:bg-dark-700 rounded-2xl p-5 min-h-72 h-full"
        >
          {/* Quick action buttons */}
          <Text as="p" weight={"medium"} className="text-font dark:text-font-dark" size={"3"}>Quick Actions</Text>
          <Grid
            columns={{ initial: "2", sm: "4" }}
            width="auto"
            className="gap-y-5 gap-x-8 px-3 mt-5"
          >
            <QuickLinks
              Icon={BsTicketPerforatedFill}
              url="/requests"
              iconStyle="bg-purple-100 dark:bg-purple-800"
              label="Request Loan"
              target={"_self"}
            />
            <QuickLinks
              Icon={IoWalletOutline}
              url="/my-contracts"
              iconStyle="bg-green-100 dark:bg-green-800"
              label="My Contracts"
              target={"_self"}
            />
            <QuickLinks
              Icon={BsBank}
              url="/request-loan"
              iconStyle="bg-pink-100 dark:bg-pink-800"
              label="Available offers"
              target={"_self"}
            />
            <QuickLinks
              Icon={RiCustomerService2Fill}
              url="https://lendasat.notion.site/"
              iconStyle="bg-gray-100 dark:bg-dark-700"
              label="Help Center"
              target={"_blank"}
            />
          </Grid>
        </Box>

        <Box
          id="contracts"
          gridColumnStart={{
            initial: "1",
          }}
          gridColumnEnd={{
            initial: "2",
            sm: "4",
          }}
          className="bg-white dark:bg-dark-700 rounded-2xl p-5 min-h-72 h-full"
        >
          <Text as="p" weight={"medium"} className="text-font dark:text-font-dark" size={"3"}>Contracts</Text>

          <Tabs.Root defaultValue={needsAction ? "actionNeeded" : "open"}>
            <Tabs.List size="2" color="blue" className="flex justify-between">
              <div className="flex">
                <Tabs.Trigger
                  value="actionNeeded"
                  className={`px-4 py-2 rounded-t-lg relative ${
                    needsAction ? "animate-pulse bg-red-100 dark:bg-red-900/30" : ""
                  } transition-colors`}
                >
                  {needsAction && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75">
                      </span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  )}
                  Action Required
                </Tabs.Trigger>
                <Tabs.Trigger value="open">Open</Tabs.Trigger>
                <Tabs.Trigger value="closed">Closed</Tabs.Trigger>
              </div>
              <Tabs.Trigger value="all" onClick={() => navigate("/my-contracts")}>
                <div className="flex items-center gap-1">
                  <Text size={"3"} weight={"bold"}>
                    All
                  </Text>
                  <ExternalLinkIcon />
                </div>
              </Tabs.Trigger>
            </Tabs.List>
            <Box>
              <Tabs.Content value="actionNeeded">
                <ContractOverview
                  contracts={contracts}
                  contractStatusFilter={{
                    requested: false,
                    renewalRequested: false,
                    approved: true,
                    collateralSeen: false,
                    opening: false,
                    open: false,
                    closing: false,
                    closed: false,
                    extended: false,
                    repaymentProvided: false,
                    repaymentConfirmed: true,
                    rejected: false,
                    expired: false,
                    canceled: false,
                    dispute: false,
                    defaulted: false,
                    undercollateralized: false,
                  }}
                />
              </Tabs.Content>
              <Tabs.Content value="open">
                <ContractOverview
                  contracts={contracts}
                  contractStatusFilter={{
                    requested: true,
                    renewalRequested: true,
                    approved: true,
                    collateralSeen: true,
                    opening: true,
                    open: true,
                    closing: false,
                    closed: false,
                    extended: false,
                    repaymentProvided: false,
                    repaymentConfirmed: false,
                    rejected: false,
                    expired: false,
                    canceled: false,
                    dispute: false,
                    defaulted: true,
                    undercollateralized: false,
                  }}
                />
              </Tabs.Content>
              <Tabs.Content value="closed">
                <ContractOverview
                  contracts={contracts}
                  contractStatusFilter={{
                    requested: false,
                    renewalRequested: false,
                    approved: false,
                    collateralSeen: false,
                    opening: false,
                    open: false,
                    closing: true,
                    closed: true,
                    extended: true,
                    repaymentProvided: false,
                    repaymentConfirmed: false,
                    rejected: true,
                    expired: true,
                    canceled: true,
                    dispute: true,
                    defaulted: false,
                    undercollateralized: true,
                  }}
                />
              </Tabs.Content>

              <Tabs.Content value="all">
                {/*// should redirect automatically*/}
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Grid>
    </Box>
  );
}

export default DashBoard;

const QuickLinks = ({ label, Icon, iconStyle, url, target }: {
  Icon: IconType;
  label: string;
  iconStyle: string;
  url: string;
  target: HTMLAttributeAnchorTarget;
}) => {
  return (
    <Button
      asChild
      variant="ghost"
      className="min-h-40 border border-font/10 dark:border-font-dark/20 flex flex-col gap-2 text-font dark:text-font-dark rounded-2xl"
    >
      <Link to={url} target={target}>
        <Box className={`h-14 w-14 rounded-full place-items-center ${iconStyle} flex justify-center`}>
          <Icon size={"20"} />
        </Box>
        <Text size={"2"} weight={"medium"}>{label}</Text>
      </Link>
    </Button>
  );
};
