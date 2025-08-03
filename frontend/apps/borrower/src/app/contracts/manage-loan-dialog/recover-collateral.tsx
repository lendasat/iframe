import React, { useState } from "react";
import { LuInfo, LuWallet, LuLoader, LuCircleAlert } from "react-icons/lu";
import { useHttpClientBorrower } from "@frontend/http-client-borrower";
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
import { formatSatsToBitcoin, getTxUrl } from "@frontend/ui-shared";
import { useWallet } from "@frontend/browser-wallet";
import type { Contract } from "@frontend/http-client-borrower";
import { useNavigate } from "react-router-dom";
import { BitcoinTransactionFeeSelector } from "@frontend/mempool";

interface RecoverCollateralDialogProps {
  children: React.ReactNode;
  collateralAmountSats?: number;
  collateralAddress?: string;
  contract?: Contract;
}

const RecoverCollateralDialog: React.FC<RecoverCollateralDialogProps> = ({
  children,
  collateralAmountSats,
  collateralAddress = "",
  contract,
}) => {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [feeRate, setFeeRate] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const { unlockAndSignClaimPsbt } = useWallet();
  const { getRecoverCollateralPsbt, postBroadcastRecover } =
    useHttpClientBorrower();
  const navigate = useNavigate();

  const handleRecover = async () => {
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
      console.log(`Selected fee rate: ${feeRate}`);
      const res = await getRecoverCollateralPsbt(contract?.id, feeRate);

      console.log("Signing recovery collateral PSBT");

      const recoveryTx = await unlockAndSignClaimPsbt(
        password,
        res.psbt,
        res.collateral_descriptor,
        res.borrower_pk,
        contract?.borrower_derivation_path,
      );
      console.log("Successfully signed recovery collateral PSBT");

      const txid = await postBroadcastRecover(contract?.id, recoveryTx.tx);
      console.log(`Published recovery transaction ${txid}`);
      setTxId(txid);
      setSuccess(true);
    } catch (err) {
      console.error("Failed to recover collateral:", err);
      setError(
        err instanceof Error
          ? err.message
          : `Failed to recover collateral. Please try again. Details ${err}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortenAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  let collateralBtc = formatSatsToBitcoin(collateralAmountSats);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recover Collateral</DialogTitle>
          <DialogDescription>
            Recover your collateral due to lender inactivity
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert className="bg-amber-50 text-amber-800 border-amber-200">
            <LuInfo className="h-4 w-4" />
            <AlertTitle>Collateral Recovery</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="font-medium">
                The lender failed to disburse the principal in time. Your full{" "}
                <span className="font-bold">{collateralBtc} BTC</span>{" "}
                collateral (minus transaction fees) will be recovered to your
                refund address:
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
              autoComplete={"current-password"}
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

          <BitcoinTransactionFeeSelector
            onSelectFee={setFeeRate}
            selectedFee={feeRate}
          />

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
                Recovery transaction successfully posted.{" "}
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
              onClick={handleRecover}
              disabled={
                isSubmitting || !password || feeRate === 0 || txId !== null
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
                  Recover Collateral
                </>
              )}
            </Button>
          )}
          {success && (
            <Button variant="default" onClick={() => navigate(0)}>
              Back to contract
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecoverCollateralDialog;
