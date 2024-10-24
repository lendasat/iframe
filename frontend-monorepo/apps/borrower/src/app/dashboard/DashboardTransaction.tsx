import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Flex, Separator, Text } from "@radix-ui/themes";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import ActivityImg from "../../assets/activity-dashboard.png";
import { Lender } from "../request-loan/lender";

interface LoansNotificationSectionProps {
  loans: Contract[];
}

function DashboardTransaction() {
  const { getContracts } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={
          <Box className="h-full flex items-center justify-center flex-col gap-y-4 pb-10 bg-white rounded-2xl">
          </Box>
        }
        children={(contracts: Awaited<Contract[]>) => (
          <Box className="bg-white/50 flex-1 flex flex-col pb-4">
            <NotificationComponent
              loans={contracts.filter((
                loan,
              ) => (loan.status))}
            />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default DashboardTransaction;

function NotificationComponent(props: LoansNotificationSectionProps) {
  const { loans } = props;

  if (loans.length === 0) {
    return (
      <Box className="min-h-56 h-full flex flex-col items-center justify-center">
        <img src={ActivityImg} alt="credit card" className="max-w-40" />
        <Text className="text-font/50" size={"1"}>We would let you know when you perform an activity...</Text>
      </Box>
    );
  }

  return (
    <div className="h-56 overflow-y-auto">
      {loans.sort((a, b) => {
        return (b.created_at - a.created_at);
      }).slice(0, 3).map((loan, index) => {
        const { lender, status, created_at, loan_amount } = loan;
        return (
          <Box key={index} py="2">
            <Flex px="2" align="center" justify="between">
              <Lender {...lender} />
              <Text size="3" weight="medium">
                <CurrencyFormatter value={loan_amount} />
              </Text>

              <Box className="flex flex-col items-end text-end gap-1">
                <Badge
                  color={status === ContractStatus.Requested
                    ? "amber"
                    : status === ContractStatus.Approved
                    ? "green"
                    : status === ContractStatus.Rejected
                    ? "red"
                    : "gray"}
                >
                  {status}
                </Badge>
                <Text size="1" className="text-font/70">{created_at.toLocaleDateString()}</Text>
              </Box>
            </Flex>
            <Separator size="4" mt="4" className="bg-font/5" />
          </Box>
        );
      })}
    </div>
  );
}
