import React, { useState } from "react";
import {
  LuQrCode,
  LuClipboard,
  LuExternalLink,
  LuInfo,
  LuCircleAlert,
  LuCheck,
} from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import { Contract } from "@frontend/http-client-borrower";
import {
  encodeBip21,
  formatSatsToBitcoin,
  LoanAssetHelper,
  usePriceForCurrency,
} from "@frontend/ui-shared";
import QRCode from "qrcode.react";

interface AddCollateralDialogProps {
  children: React.ReactNode;
  contract?: Contract;
  isInitialFunding: boolean;
}

const AddCollateralDialog = ({
  children,
  isInitialFunding = false,
  contract,
}: AddCollateralDialogProps) => {
  const [open, setOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(contract?.loan_asset),
  );

  const collateralBtc = contract?.initial_collateral_sats
    ? contract.initial_collateral_sats / 100000000
    : undefined;
  const originationFeeBtc = contract?.origination_fee_sats
    ? contract.origination_fee_sats / 100000000
    : undefined;

  const depositAddress = contract?.contract_address;
  const bip21Url =
    depositAddress && collateralBtc && originationFeeBtc
      ? encodeBip21(depositAddress, {
          amount: isInitialFunding
            ? Number((collateralBtc + originationFeeBtc).toFixed(8))
            : 0,
          label: `fund contract ${contract?.id}`,
        })
      : undefined;

  const minAmount = contract?.initial_collateral_sats;
  const mempoolLink = `${import.meta.env.VITE_MEMPOOL_REST_URL}/address/${depositAddress}`;

  const minAmountBtc = minAmount
    ? Number.parseFloat((minAmount / 100000000).toFixed(8))
    : undefined;
  const minAmountBtcFormatted = formatSatsToBitcoin(minAmount);
  const minAmountUsd =
    latestPrice && minAmount
      ? ((minAmount / 100000000) * latestPrice).toFixed(2)
      : "0.00";

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };
  const handleCopyAmount = async (amount: number) => {
    await navigator.clipboard.writeText(amount.toFixed(8));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isInitialFunding
              ? "Fund Contract with Collateral"
              : "Add Collateral"}
          </DialogTitle>
          <DialogDescription>
            {isInitialFunding
              ? "Deposit Bitcoin collateral to activate your loan"
              : "Add more Bitcoin collateral to improve your loan-to-value ratio"}
          </DialogDescription>
        </DialogHeader>

        {depositAddress ? (
          <>
            <div className="flex justify-center">
              <div
                className="cursor-copy rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
                onClick={
                  bip21Url ? () => handleCopyAddress(bip21Url) : undefined
                }
                title="Click to copy address"
              >
                {bip21Url ? (
                  <QRCode value={bip21Url} size={200} />
                ) : (
                  <LuQrCode className="h-48 w-48 text-black" />
                )}
              </div>
            </div>

            {isInitialFunding && (
              <Alert>
                <LuInfo className="h-4 w-4" />
                <AlertTitle>Minimum deposit required</AlertTitle>
                <AlertDescription>
                  <div className="flex items-center space-x-2">
                    {minAmountBtcFormatted} BTC (${minAmountUsd})
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopyAmount(minAmountBtc || 0)}
                    >
                      {copiedAmount ? (
                        <LuCheck className="h-4 w-4" />
                      ) : (
                        <LuClipboard className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="deposit-address" className="sr-only">
                  Deposit Address
                </Label>
                <Input
                  id="deposit-address"
                  value={depositAddress}
                  readOnly
                  className="font-mono text-sm"
                />
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleCopyAddress(depositAddress)}
              >
                {copiedAddress ? (
                  <LuCheck className="h-4 w-4" />
                ) : (
                  <LuClipboard className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="text-sm text-gray-500">
              <p>Send only Bitcoin (BTC) to this address.</p>
              <p className="mt-1">
                Deposit will be credited automatically once confirmed on the
                blockchain.
              </p>
            </div>

            {isInitialFunding && (
              <Alert variant="destructive">
                <LuCircleAlert className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  You must fund the contract within 24 hours or it will expire.
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <div className="space-y-4 py-4">
            <Skeleton className="mx-auto h-48 w-48 rounded-lg" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="sm:mt-0"
          >
            Close
          </Button>

          <Button asChild>
            <a
              href={mempoolLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              View on Mempool <LuExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCollateralDialog;
