import { LuCircleCheck, LuClipboard, LuClock, LuInfo } from "react-icons/lu";
import React, { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  CardContent,
  Separator,
  Skeleton,
} from "@frontend/shadcn";
import { Contract } from "@frontend/http-client-borrower";
import {
  formatCurrency,
  formatSatsToBitcoin,
  getFormatedStringFromDays,
  LoanAssetHelper,
  usePrice,
} from "@frontend/ui-shared";
import { format, formatDistanceToNow } from "date-fns";
import LoanStatusInformation from "./contract-status-text";

const shortenUuid = (uuid: string) => {
  const firstSix = uuid.slice(0, 6);
  const lastFour = uuid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface DetailsProps {
  contract?: Contract;
}

export const Details = ({ contract }: DetailsProps) => {
  const [contractIdCopied, setContractIdCopied] = useState(false);
  const { latestPrice } = usePrice();

  const contractId = contract?.id;
  const lender = contract?.lender;
  const loanAmount = contract?.loan_amount
    ? formatCurrency(contract.loan_amount)
    : undefined;
  const loanAsset = contract?.loan_asset
    ? LoanAssetHelper.print(contract.loan_asset)
    : undefined;
  const loanDuration = contract?.duration_days
    ? getFormatedStringFromDays(contract.duration_days)
    : undefined;
  const loanDurationRemaining =
    contract?.created_at && contract?.expiry
      ? formatDistanceToNow(contract?.expiry, {
          addSuffix: true,
        })
      : undefined;
  const loanExpiryFormatted = contract?.expiry
    ? format(contract.expiry, "MMM, do yyyy - p")
    : undefined;

  const originationFee = formatSatsToBitcoin(contract?.origination_fee_sats);
  const interestRate = contract?.interest_rate
    ? `${(contract.interest_rate * 100).toFixed(2)}%`
    : undefined;
  const lenderName = contract?.lender.name;
  const lenderNameInitials = lenderName?.substr(0, 2);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContractIdCopied(true);
      setTimeout(() => setContractIdCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <CardContent className="pt-2">
      <div className="flex justify-between items-center my-2">
        <div>
          <p className="text-sm text-gray-500">Contract ID</p>
          <div className="flex items-center">
            {contractId ? (
              <p className="font-mono">{shortenUuid(contractId)}</p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1"
              onClick={() => handleCopy(contractId || "")}
            >
              {contractIdCopied ? (
                <LuCircleCheck className="h-4 w-4" />
              ) : (
                <LuClipboard className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Lender</p>
          {lender ? (
            <div className="flex items-center justify-end">
              <p className="mr-2">{lenderName}</p>
              <Avatar className="h-6 w-6">
                <AvatarFallback>{lenderNameInitials}</AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Skeleton className="h-4 w-[150px] mr-2" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">Loan Amount</p>
          {loanAmount ? (
            <p className="text-xl font-bold">{loanAmount}</p>
          ) : (
            <Skeleton className="h-4 w-[150px] mb-2" />
          )}

          {loanAsset ? (
            <p className="text-xs text-gray-500">{loanAsset}</p>
          ) : (
            <Skeleton className="h-4 w-[150px] mb-2" />
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Duration</p>
          {loanDuration ? (
            <p>{loanDuration}</p>
          ) : (
            <Skeleton className="h-4 w-[150px] mb-2" />
          )}

          <div className="flex items-center text-xs text-gray-500">
            <LuClock className="h-3 w-3 mr-1" />
            {loanDurationRemaining ? (
              <span>{loanDurationRemaining}</span>
            ) : (
              <Skeleton className="h-4 w-[50px]" />
            )}
          </div>
        </div>
        <div className="text-right md:col-span-1 col-span-2">
          <p className="text-sm text-gray-500">Expiry</p>
          {loanExpiryFormatted ? (
            <p>{loanExpiryFormatted}</p>
          ) : (
            <Skeleton className="h-4 w-[150px] mb-2" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4  mt-4">
        <div>
          <p className="text-sm text-gray-500">Origination Fee</p>
          {originationFee ? (
            <div className={"flex items-center gap-3"}>
              <p>BTC</p>
              <p className={"font-mono"}>{originationFee}</p>
            </div>
          ) : (
            <Skeleton className="h-4 w-[150px] mb-2" />
          )}
        </div>
        <div className="text-right md:col-span-1 col-span-2">
          <p className="text-sm text-gray-500">Interest Rate</p>
          {interestRate ? (
            <p>{interestRate}</p>
          ) : (
            <Skeleton className="h-4 w-[150px] mb-2" />
          )}
        </div>
      </div>

      <Separator className="my-4" />

      <LoanStatusInformation contract={contract} />
    </CardContent>
  );
};
