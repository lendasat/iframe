import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Check, Copy, Loader2, SquareArrowOutUpRight } from "lucide-react";
import { Separator } from "@/components/ui/separator.tsx";
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
} from "./components/ui/data-list";
import { Badge } from "./components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Input } from "./components/ui/input";
import {
  Contract,
  ContractStatus,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { useAsync, useAsyncFn } from "react-use";
import { LuInfo } from "react-icons/lu";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { downloadContractBackup } from "./download-contract-backup";

interface LoanTermsProps {
  sendContractRequest: () => Promise<Contract | undefined>;
  onPrincipalGiven: (contractId: string) => void;
}

const LoanTerms = ({
  sendContractRequest,
  onPrincipalGiven,
}: LoanTermsProps) => {
  const {
    value: contract,
    error,
    loading,
  } = useAsync(async () => {
    return sendContractRequest();
  }, []);

  const [downloadLoading, setDownloadLoading] = useState(false);

  const [principalGiven, setPrincipalGiven] = useState(false);

  const { getContract } = useHttpClientBorrower(); // Assumed from your imports

  const [state, fetchContract] = useAsyncFn(async () => {
    if (contract?.id) {
      return await getContract(contract.id);
    }
  }, [contract?.id]);

  useEffect(() => {
    if (contract?.id) {
      fetchContract();
      const intervalId = setInterval(fetchContract, 10000);
      return () => clearInterval(intervalId);
    }
  }, [fetchContract, contract]);

  useEffect(() => {
    if (
      state.value?.status === ContractStatus.PrincipalGiven &&
      contract &&
      !principalGiven
    ) {
      onPrincipalGiven(contract.id);
      setPrincipalGiven(true);
      toast.success("Contract funded. You are all done!");
    }
  }, [state, contract, onPrincipalGiven]);

  if (loading || !contract) {
    return (
      <div className="mx-auto max-w-md">
        <Skeleton className="h-24 mb-4" />
        <Skeleton className="h-12 mb-4" />
        <Skeleton className="h-12 mb-4" />
        <Skeleton className="h-12 mb-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md text-center text-red-500">
        <p>Something went wrong while fetching the data.</p>
        <p>{error.message}</p>
      </div>
    );
  }

  const contractId = contract.id;
  const loanAmount = contract.loan_amount;
  const collateralAmountSats = contract.initial_collateral_sats;
  const yearlyInterestRate = contract.interest_rate;
  const contractAddress = state.value?.contract_address;
  const durationDays = contract.duration_days;

  const contractStatus = state.value?.status || ContractStatus.Requested;

  let status;
  let statusVariant;
  switch (contractStatus) {
    case ContractStatus.Requested:
      status = "Requested";
      statusVariant = "default";
      break;
    case ContractStatus.Approved:
      status = "Waiting for collateral";
      statusVariant = "default";
      break;
    case ContractStatus.CollateralSeen:
    case ContractStatus.CollateralConfirmed:
      status = "Loan Collateralized";
      statusVariant = "default";
      break;
    case ContractStatus.PrincipalGiven:
      status = "Ready";
      statusVariant = "success";
      break;
    default:
      status = "Something went wrong";
      statusVariant = "destructive";
      break;
  }

  const loanAmountString = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(loanAmount);

  const collateralAmountString = new Intl.NumberFormat("en-US").format(
    collateralAmountSats,
  );

  const loanData = {
    id: contractId,
    status,
    statusVariant,
    loanAmount: `\$${loanAmountString}`,
    bitcoinCollateral: `${collateralAmountString} sats`,
    interestRate: `${yearlyInterestRate * 100}% p.a.`,
    loanDuration: `${durationDays} days`,
  };

  const handleDownload = () => {
    setDownloadLoading(true);

    try {
      downloadContractBackup(contract);
    } catch (error) {
      toast.error("Failed to download contract backup.");
      setDownloadLoading(false);

      return;
    }

    toast.success("Downloading contract backup.");

    setDownloadLoading(false);
  };

  const borrowerBaseUrl = import.meta.env.VITE_BORROWER_BASE_URL;

  return (
    <div className="mx-auto max-w-md">
      <Card className="gap-3 p-4">
        <CardHeader>
          <CardTitle>Loan Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <DataList orientation="horizontal" className="gap-4">
            <DataListItem>
              <DataListLabel className="w-32">Status</DataListLabel>
              <DataListValue>
                <Badge variant={statusVariant}>{loanData.status}</Badge>
              </DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel className="w-32">ID</DataListLabel>
              <DataListValue className="flex items-center gap-2 text-xs overflow-hidden">
                <span className="truncate">{loanData.id}</span>
                <Button
                  size={"icon"}
                  variant={"outline"}
                  onClick={() => {
                    const url = `${borrowerBaseUrl}/my-contracts/${contractId}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <SquareArrowOutUpRight className="h-4 w-4" />
                </Button>
              </DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel className="w-32">Loan amount</DataListLabel>
              <DataListValue>{loanData.loanAmount}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel className="w-32">Collateral amount</DataListLabel>
              <DataListValue>{loanData.bitcoinCollateral}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel className="w-32">Interest rate</DataListLabel>
              <DataListValue>{loanData.interestRate}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel className="w-32">Loan duration</DataListLabel>
              <DataListValue>{loanData.loanDuration}</DataListValue>
            </DataListItem>
          </DataList>

          <Separator className="my-4 border-gray-600" />

          <div className="my-8 flex w-full max-w-md flex-col items-center justify-center">
            <div className="relative inline-block">
              {/* QR Code */}
              <QRCodeSVG value={contractAddress || ""} size={200} />

              {/* Overlay with checkmark when success is true */}
              {contractStatus === ContractStatus.PrincipalGiven && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-green-200 bg-opacity-10 rounded-full w-32 h-32 flex items-center justify-center">
                    <Check color="white" size={64} strokeWidth={3} />
                  </div>
                </div>
              )}
            </div>

            <Alert className="mt-4">
              <LuInfo className="h-4 w-4" />
              <AlertTitle className="text-left">
                Minimum deposit required
              </AlertTitle>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  {collateralAmountString} sats
                  <Button
                    size="sm"
                    className="px-3"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        collateralAmountSats.toString(),
                      );
                      toast.success("Copied amount to clipboard");
                    }}
                  >
                    <span className="sr-only">Copy</span>
                    <Copy />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex w-full items-center space-x-2 pt-4">
              <Input
                id="link"
                defaultValue={contractAddress}
                readOnly
                className="flex-1"
              />
              <Button
                size="sm"
                className="px-3"
                onClick={() => {
                  navigator.clipboard.writeText(contractAddress);
                  toast.success("Copied address to clipboard");
                }}
              >
                <span className="sr-only">Copy</span>
                <Copy />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={handleDownload}
            disabled={downloadLoading}
          >
            {downloadLoading && <Loader2 className="animate-spin" />}
            Download contract details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanTerms;
