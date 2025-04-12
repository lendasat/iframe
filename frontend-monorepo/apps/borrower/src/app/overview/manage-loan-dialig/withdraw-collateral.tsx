import React, { useState } from "react";
import {
  LuInfo,
  LuWallet,
  LuClock,
  LuLoader,
  LuCircleAlert,
} from "react-icons/lu";
import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { RadioGroup, RadioGroupItem } from "@frontend/shadcn";
import { cn } from "@frontend/shadcn";
import { formatSatsToBitcoin, getTxUrl } from "@frontend/ui-shared";
import { useWallet } from "@frontend/browser-wallet";
import type { Contract } from "@frontend/http-client-borrower";
import { useNavigate } from "react-router-dom";

interface WithdrawCollateralDialogProps {
  children: React.ReactNode;
  collateralAmountSats?: number;
  collateralAddress?: string;
  contract?: Contract;
}

const feeOptions = [
  {
    id: "slow",
    label: "Slow",
    sublabel: "~1d",
    value: 1,
    description: "1 sat/vB",
  },
  {
    id: "medium",
    label: "Medium",
    sublabel: "~60m",
    value: 5,
    description: "5 sat/vB",
  },
  {
    id: "fast",
    label: "Fast",
    sublabel: "~10m",
    value: 10,
    description: "10 sat/vB",
  },
];

const WithdrawCollateralDialog: React.FC<WithdrawCollateralDialogProps> = ({
  children,
  collateralAmountSats,
  collateralAddress = "",
  contract,
}) => {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [feeRate, setFeeRate] = useState<number>(feeOptions[2].value); // Default to fast
  const [customFee, setCustomFee] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const { unlockAndSignClaimPsbt } = useWallet();
  const { getClaimCollateralPsbt, postClaimTx } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const handleWithdraw = async () => {
    if (!password) {
      setError("Password is required");
      return;
    }

    if (!contract) {
      setError("Contract is required");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Use custom fee if selected, otherwise use the selected fee rate
      const finalFeeRate = feeRate === 0 ? parseInt(customFee) : feeRate;

      console.log(`Final fee: ${finalFeeRate}`);
      const res = await getClaimCollateralPsbt(contract?.id, finalFeeRate);

      console.log("Signing claim collateral PSBT");

      const claimTx = await unlockAndSignClaimPsbt(
        password,
        res.psbt,
        res.collateral_descriptor,
        res.borrower_pk,
        contract?.borrower_derivation_path,
      );
      console.log(`Successfully signed claim collateral PSBT`);
      const txid = await postClaimTx(contract?.id, claimTx.tx);
      console.log(`Published transaction ${txid}`);
      setTxId(txid);
      setSuccess(true);
    } catch (err) {
      console.error("Failed to withdraw funds:", err);
      setError(
        err instanceof Error
          ? err.message
          : `Failed to withdraw funds. Please try again. Details ${err}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortenAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleFeeRateChange = (value: string) => {
    const numValue = parseInt(value);
    setFeeRate(numValue);

    // Clear custom fee if not selecting custom
    if (numValue !== 0) {
      setCustomFee("");
    }
  };

  let collateralBtc = formatSatsToBitcoin(collateralAmountSats);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw Collateral</DialogTitle>
          <DialogDescription>
            Withdraw your collateral back to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert className="bg-blue-50 text-blue-800 border-blue-200">
            <LuInfo className="h-4 w-4" />
            <AlertTitle>Collateral Information</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="font-medium">
                The <span className="font-bold">{collateralBtc} BTC</span>{" "}
                collateral will be sent to your collateral refund address:
              </div>
              <div className="font-mono text-sm mt-1 break-all">
                {shortenAddress(collateralAddress)}
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className={error && !password ? "border-red-500" : ""}
            />
            {error && !password && (
              <p className="text-sm text-red-500 mt-1">Password is required</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Transaction Fee Rate</Label>
            <RadioGroup
              value={feeRate.toString()}
              onValueChange={handleFeeRateChange}
              className="grid grid-cols-3 gap-2"
            >
              {feeOptions.map((option) => (
                <div key={option.id} className="relative">
                  <RadioGroupItem
                    value={option.value.toString()}
                    id={`fee-${option.id}`}
                    className="sr-only peer"
                  />
                  <label
                    htmlFor={`fee-${option.id}`}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-28",
                    )}
                  >
                    <div className="flex flex-col items-center text-center h-full justify-center">
                      <LuClock className="mb-2 h-5 w-5" />
                      <div className="text-md font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {option.sublabel}
                      </div>
                      <div className="text-xs mt-1">{option.description}</div>
                    </div>
                  </label>
                </div>
              ))}
            </RadioGroup>

            <div className="mt-4">
              <RadioGroup
                value={feeRate === 0 ? "0" : feeRate.toString()}
                onValueChange={handleFeeRateChange}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="0" id="fee-custom" />
                  <Label htmlFor="fee-custom" className="font-medium">
                    Custom
                  </Label>
                </div>
              </RadioGroup>

              {feeRate === 0 && (
                <div className="mt-2">
                  <Input
                    type="number"
                    placeholder="Enter sats/vByte"
                    value={customFee}
                    onChange={(e) => setCustomFee(e.target.value)}
                    min="1"
                    className={cn(
                      "font-mono",
                      error && feeRate === 0 && !customFee
                        ? "border-red-500"
                        : "",
                    )}
                  />
                  {error && feeRate === 0 && !customFee && (
                    <p className="text-sm text-red-500 mt-1">
                      Please enter a custom fee rate
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && error !== "Password is required" && (
            <Alert variant="destructive">
              <LuCircleAlert className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="max-w-sm break-words">
                {error}
              </AlertDescription>
            </Alert>
          )}
          {txId && (
            <Alert>
              <LuCircleAlert className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Claim transaction successfully posted.{" "}
                <a
                  href={getTxUrl(txId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  View on mempool.space
                </a>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          {!success && (
            <Button
              variant="default"
              onClick={handleWithdraw}
              disabled={
                isSubmitting ||
                !password ||
                (feeRate === 0 && !customFee) ||
                txId !== null
              }
            >
              {isSubmitting ? (
                <>
                  <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LuWallet className="mr-2 h-4 w-4" />
                  Withdraw Funds
                </>
              )}
            </Button>
          )}
          {success && (
            <Button variant="default" onClick={() => navigate(0)}>
              <>Back to contract</>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawCollateralDialog;
