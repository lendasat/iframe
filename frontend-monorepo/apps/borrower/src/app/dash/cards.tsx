import { SquareArrowOutUpRight } from "lucide-react";
import { Skeleton } from "@frontend/shadcn";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@frontend/shadcn";
import { Contract, isContractOpen } from "@frontend/http-client-borrower";
import { formatCurrency, formatSatsToBitcoin } from "@frontend/ui-shared";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface SectionCardsProps {
  isLoading: boolean;
  contracts: Contract[];
}

export function SectionCards({ isLoading, contracts }: SectionCardsProps) {
  const navigate = useNavigate();

  const totalActiveContracts = contracts.filter((loan) =>
    isContractOpen(loan.status),
  );

  const contractWithEarliestExpiry = totalActiveContracts.reduce(
    (earliest: Contract | undefined, current) => {
      // If there's no earliest yet, or the current contract has an earlier expiry
      if (!earliest || current.expiry < earliest.expiry) {
        return current;
      }
      return earliest;
    },
    undefined,
  );

  const lockedSats = totalActiveContracts
    .map((c) => c.collateral_sats)
    .reduce((sum, amount) => sum + amount, 0);
  const lockedUsd = totalActiveContracts
    .map((c) => c.loan_amount)
    .reduce((sum, amount) => sum + amount, 0);

  const openInterest = totalActiveContracts
    .map((c) => c.interest)
    .reduce((sum, amount) => sum + amount, 0);

  return (
    <div className="flex flex-col gap-4 mt-4 md:gap-6">
      <div
        className={
          "grid gap-4 xs:grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 px-6"
        }
      >
        <Card className="@container/card">
          <CardHeader className="relative">
            <CardDescription>Total Loan Outstanding</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton>$1,250.00</Skeleton>
              ) : (
                formatCurrency(lockedUsd)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader className="relative">
            <CardDescription>Open Interest</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton>$1,250.00</Skeleton>
              ) : (
                formatCurrency(openInterest)
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="@container/card">
          <CardHeader className="relative">
            <CardDescription>Locked Collateral</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {isLoading ? (
                <Skeleton>1.0</Skeleton>
              ) : (
                <span className="whitespace-nowrap">{`${formatSatsToBitcoin(lockedSats)} BTC`}</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="@container/card">
          <CardHeader className="relative">
            <CardDescription>Next Expiry</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {isLoading || !contractWithEarliestExpiry ? (
                <Skeleton>03.01.2009</Skeleton>
              ) : (
                format(contractWithEarliestExpiry.expiry, "MMM, dd yyyy")
              )}
              <div className="absolute right-4 top-4">
                {contractWithEarliestExpiry && (
                  <Button
                    size={"icon"}
                    variant={"outline"}
                    onClick={() => {
                      navigate(
                        `/my-contracts/${contractWithEarliestExpiry?.id}`,
                      );
                    }}
                  >
                    <SquareArrowOutUpRight className={"h-4 w-4"} />
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
