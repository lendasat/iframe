import { useState } from "react";
import type { ChangeEvent } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Info } from "lucide-react";
import { LoanAssetHelper, type LoanAsset } from "@repo/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertDescription } from "./ui/alert";
import { Alert } from "./ui/alert";

interface LoanAddressInputFieldProps {
  loanAddress: string;
  setLoanAddress: (value: string) => void;
  loanAsset: LoanAsset;
  hideButton?: boolean;
  renderWarning?: boolean;
  setHideButton?: (value: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LoanAddressInputField({
  loanAddress,
  setLoanAddress,
  loanAsset,
  hideButton = false,
  renderWarning = true,
  setHideButton,
  placeholder = "Enter a valid address",
  disabled = false,
}: LoanAddressInputFieldProps) {
  const [manualInput, setManualInput] = useState(true);

  const loanAssetChain = LoanAssetHelper.toChain(loanAsset);

  let warning = "";
  if (manualInput && renderWarning) {
    warning = `Provide a valid address on the ${loanAssetChain} network. Providing an incorrect address here will lead to loss of funds.`;
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    setManualInput(true);
    if (setHideButton) {
      setHideButton(false);
    }
    setLoanAddress(e.target.value);
  }

  const onAddressFetched = (address: string) => {
    setLoanAddress(address);
    if (setHideButton) {
      setHideButton(true);
    }
    setManualInput(false);
  };

  // WalletConnect extension only supports Ethereum and Ethereum-L2s... No Starknet
  const isStarknet = loanAsset === "UsdtStrk" || loanAsset === "UsdcStrk";
  // WalletConnect does not support Solana at this point of time
  const isSolana = loanAsset === "UsdcSol" || loanAsset === "UsdtSol";
  // WalletConnect does not support Liquid at this point of time
  const isLiquid = loanAsset === "UsdtLiquid";

  return (
    <div className="w-full space-y-2">
      {warning && renderWarning && (
        <Alert variant={"warning"}>
          <Info className="h-4 w-4" />
          <AlertDescription>{warning.trim()}</AlertDescription>
        </Alert>
      )}

      <div className="relative flex w-full items-center gap-2">
        <Input
          className="pr-32"
          placeholder={placeholder}
          type="text"
          value={loanAddress}
          onChange={onInputChange}
          disabled={disabled}
          data-1p-ignore
        />

        {!isStarknet && !isSolana && !isLiquid && !hideButton && (
          <div className="absolute right-2">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={openConnectModal}
                            type="button"
                          >
                            Connect Wallet
                          </Button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={openChainModal}
                            type="button"
                          >
                            Wrong network
                          </Button>
                        );
                      }

                      return (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onAddressFetched(account.address);
                          }}
                          type="button"
                        >
                          Get Address
                        </Button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        )}
      </div>
    </div>
  );
}
