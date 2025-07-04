import { toast } from "sonner";
import { downloadContractBackup } from "./download-contract-backup";
import {
  LuCircleCheck,
  LuClipboard,
  LuClock,
  LuDownload,
} from "react-icons/lu";
import React, { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  CardContent,
  Separator,
  Skeleton,
} from "@frontend/shadcn";
import { Contract, useAuth } from "@frontend/http-client-lender";
import {
  formatCurrency,
  formatSatsToBitcoin,
  getFormatedStringFromDays,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { format, formatDistanceToNow } from "date-fns";
import LoanStatusInformation from "./contract-status-text";

export const shortenUuid = (uuid: string) => {
  const firstSix = uuid.slice(0, 6);
  const lastFour = uuid.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface DetailsProps {
  contract?: Contract;
}

export const Details = ({ contract }: DetailsProps) => {
  const { backendVersion } = useAuth();
  const [contractIdCopied, setContractIdCopied] = useState(false);

  const contractId = contract?.id;
  const borrower = contract?.borrower;
  const loanAmount = contract?.loan_amount
    ? formatCurrency(
        contract.loan_amount,
        LoanAssetHelper.toCurrency(contract.loan_asset),
      )
    : undefined;
  const loanAsset = contract?.loan_asset
    ? LoanAssetHelper.print(contract.loan_asset)
    : undefined;
  const loanDuration = contract?.duration_days
    ? getFormatedStringFromDays(contract.duration_days)
    : undefined;
  const loanDurationRemaining =
    contract?.created_at && contract?.expiry
      ? formatDistanceToNow(contract.expiry, {
          addSuffix: true,
        })
      : undefined;
  const loanExpiryFormatted = contract?.expiry
    ? format(contract.expiry, "MMM, dd yyyy - p")
    : undefined;

  const originationFee = formatSatsToBitcoin(contract?.origination_fee_sats);
  const interestRate = contract?.interest_rate
    ? `${(contract.interest_rate * 100).toFixed(2)}%`
    : undefined;
  const interestAmount = contract?.interest;
  const borrowerName = contract?.borrower.name;
  const borrowerNameInitials = borrowerName?.substr(0, 2);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContractIdCopied(true);
      setTimeout(() => setContractIdCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Simple skeleton component for loading state
  const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse rounded bg-gray-200 ${className}`}></div>
  );

  const downloadBackupFn = () => {
    if (contract) {
      try {
        downloadContractBackup(backendVersion, contract);
        toast.success("Downloading contract backup...");
      } catch (e) {
        console.log("Failed to download contract backup:", e);
        toast.error("Failed to download contract backup.");
      }
    } else {
      toast.error("Failed to download contract backup.");
    }
  };

  return (
    <CardContent className="pt-2">
      <div className="my-2 flex items-center justify-between">
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
              className="ml-1 h-6 w-6"
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
          <p className="text-sm text-gray-500">Borrower</p>
          {borrower && borrowerNameInitials ? (
            <div className="flex items-center justify-end">
              <p className="mr-2">{borrowerName}</p>
              <Avatar className="h-6 w-6">
                <AvatarFallback>{borrowerNameInitials}</AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Skeleton className="mr-2 h-4 w-[150px]" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      <LoanDetails
        loanAsset={loanAsset}
        originationFee={originationFee}
        loanAmount={loanAmount}
        loanDuration={loanDuration}
        loanDurationRemaining={loanDurationRemaining}
        interestRate={interestRate}
        interestAmount={interestAmount}
        loanExpiryFormatted={loanExpiryFormatted}
        downloadBackup={downloadBackupFn}
      />

      <Separator className="my-4" />

      <LoanStatusInformation contract={contract} />
    </CardContent>
  );
};

interface LoanDetailsProps {
  loanAmount?: string;
  loanAsset?: string;
  loanDuration?: string;
  loanExpiryFormatted?: string;
  loanDurationRemaining?: string;
  originationFee?: string;
  interestRate?: string;
  interestAmount?: number;
  downloadBackup: () => void;
}

// Main component with typed props
const LoanDetails: React.FC<LoanDetailsProps> = ({
  loanAmount,
  loanAsset,
  loanDuration,
  loanExpiryFormatted,
  loanDurationRemaining,
  originationFee,
  interestRate,
  interestAmount,
  downloadBackup,
}) => {
  // Component now split into mobile and desktop layouts
  return (
    <>
      {/* Mobile layout - visible only on small screens */}
      <div className="md:hidden">
        <div className="space-y-4">
          {/* Loan Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Loan Amount</p>
              {loanAmount ? (
                <p className={"text-xl font-bold"}>{loanAmount}</p>
              ) : (
                <Skeleton className="mb-2 h-4 w-[80px]" />
              )}
              {loanAsset ? (
                <p className="text-xs text-gray-500">{loanAsset}</p>
              ) : (
                <Skeleton className="mb-2 h-4 w-[150px]" />
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Interest Rate</p>
              {interestRate ? (
                <p>{interestRate} p.a.</p>
              ) : (
                <Skeleton className="mb-2 ml-auto h-4 w-[80px]" />
              )}
              {interestAmount ? (
                <p className="text-xs text-gray-500">
                  {formatCurrency(
                    interestAmount,
                    LoanAssetHelper.toCurrency(loanAsset),
                  )}
                </p>
              ) : (
                <Skeleton className="mb-2 ml-auto h-4 w-[150px]" />
              )}
            </div>
          </div>

          {/* Expiry */}
          <div className="grid grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Expiry</p>
              {loanExpiryFormatted ? (
                <p className="whitespace-nowrap">{loanExpiryFormatted}</p>
              ) : (
                <Skeleton className="mb-2 h-4 w-[150px]" />
              )}
              <div className="flex items-center text-xs text-gray-500">
                <LuClock className="mr-1 h-3 w-3" />
                {loanDurationRemaining ? (
                  <span>{loanDurationRemaining}</span>
                ) : (
                  <Skeleton className="h-3 w-[50px]" />
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Duration</p>
              {loanDuration ? (
                <p>{loanDuration}</p>
              ) : (
                <Skeleton className="mb-2 ml-auto h-4 w-[80px]" />
              )}
            </div>
          </div>

          {/* Origination Fee */}
          <div className="grid grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Origination Fee</p>
              {originationFee ? (
                <div className="flex items-center gap-3">
                  <p className="font-mono">{originationFee}</p>
                </div>
              ) : (
                <Skeleton className="mb-2 h-4 w-[150px]" />
              )}
            </div>
            <div className="text-right">
              <Button variant="ghost" onClick={downloadBackup}>
                <LuDownload />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop layout - visible on md screens and up */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Loan Amount</p>
            {loanAmount ? (
              <p className="text-xl font-bold">{loanAmount}</p>
            ) : (
              <Skeleton className="mb-2 h-4 w-[150px]" />
            )}

            {loanAsset ? (
              <p className="text-xs text-gray-500">{loanAsset}</p>
            ) : (
              <Skeleton className="mb-2 h-4 w-[150px]" />
            )}
          </div>
          <div className="col-span-2 text-right md:col-span-1">
            <div className="text-right">
              <p className="text-sm text-gray-500">Interest Rate</p>
              {interestRate ? (
                <p>{interestRate} p.a.</p>
              ) : (
                <Skeleton className="mb-2 ml-auto h-4 w-[80px]" />
              )}
              {interestAmount ? (
                <p className="text-xs text-gray-500">
                  {formatCurrency(
                    interestAmount,
                    LoanAssetHelper.toCurrency(loanAsset),
                  )}
                </p>
              ) : (
                <Skeleton className="mb-2 ml-auto h-4 w-[150px]" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            {loanDuration ? (
              <p>{loanDuration}</p>
            ) : (
              <Skeleton className="mb-2 h-4 w-[150px]" />
            )}
          </div>
          <div className="col-span-2 text-right md:col-span-1">
            <p className="text-sm text-gray-500">Expiry</p>
            {loanExpiryFormatted ? (
              <p>{loanExpiryFormatted}</p>
            ) : (
              <Skeleton className="mb-2 ml-auto h-4 w-[150px]" />
            )}
            <div className="flex items-center justify-end text-xs text-gray-500">
              <LuClock className="mr-1 h-3 w-3" />
              {loanDurationRemaining ? (
                <span>{loanDurationRemaining}</span>
              ) : (
                <Skeleton className="h-4 w-[50px]" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Origination Fee</p>
            {originationFee ? (
              <div className="flex items-center gap-3">
                <p className="font-mono">BTC {originationFee}</p>
              </div>
            ) : (
              <Skeleton className="mb-2 h-4 w-[150px]" />
            )}
          </div>
          <div className="col-span-2 text-right md:col-span-1">
            <Button variant="ghost" onClick={downloadBackup}>
              <LuDownload /> Download backup
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
