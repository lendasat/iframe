import { ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import { Box, Button, Grid, Heading, Skeleton, Tabs, Text } from "@radix-ui/themes";
import type { HTMLAttributeAnchorTarget } from "react";
import type { IconType } from "react-icons";
import { BsBank, BsTicketPerforatedFill } from "react-icons/bs";
import { IoWalletOutline } from "react-icons/io5";
import { RiCustomerService2Fill } from "react-icons/ri";
import { Link } from "react-router-dom";
import { useAsync } from "react-use";

function DashBoard() {
  const { innerHeight } = window;
  const { getContracts } = useBorrowerHttpClient();

  const { loading, value } = useAsync(async () => {
    return await getContracts();
  }, []);

  const totalLoanAmount = value
    ? value
      .filter((loan) => loan.status === ContractStatus.PrincipalGiven)
      .map((loan) => loan.loan_amount)
      .reduce((sum, amount) => sum + amount, 0)
    : 0;

  // All the loans that were at least approved by the lender.
  const totalLoans = value?.filter((loan) =>
    loan.status !== ContractStatus.Rejected && loan.status !== ContractStatus.RequestExpired
    && loan.status !== ContractStatus.Cancelled
  ).length;

  const totalActiveLoans = value?.filter((loan) =>
    loan.status !== ContractStatus.Requested && loan.status !== ContractStatus.Approved
    && loan.status !== ContractStatus.CollateralSeen && loan.status !== ContractStatus.Rejected
    && loan.status !== ContractStatus.RequestExpired && loan.status !== ContractStatus.Cancelled
    && loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Closing
  ).length;

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
          <Tabs.Root defaultValue="open">
            <Tabs.List size="2" color="blue">
              <Tabs.Trigger value="open">
                Open
              </Tabs.Trigger>
              <Tabs.Trigger value="closed" disabled={true}>Closed</Tabs.Trigger>
              <Tabs.Trigger value="all" disabled={true}>All</Tabs.Trigger>
            </Tabs.List>

            <Box pt="3">
              <Tabs.Content value="open">
                <Text size="2">Open contracts</Text>
              </Tabs.Content>

              <Tabs.Content value="closed">
                <Text size="2">Closed contracts</Text>
              </Tabs.Content>

              <Tabs.Content value="all">
                <Text size="2">All contracts</Text>
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
