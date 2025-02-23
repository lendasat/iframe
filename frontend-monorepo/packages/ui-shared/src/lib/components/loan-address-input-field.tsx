import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { connect } from "starknetkit";
import { LoanAsset, LoanAssetHelper } from "../models";

interface LoanAddressInputFieldProps {
  loanAddress: string;
  setLoanAddress: (value: string) => void;
  loanAsset: LoanAsset;
  hideButton: boolean;
  renderWarning?: boolean;
  setHideButton: (value: boolean) => void;
}

export function LoanAddressInputField({
  loanAddress,
  setLoanAddress,
  loanAsset,
  hideButton,
  setHideButton,
  renderWarning,
}: LoanAddressInputFieldProps) {
  const [manualInput, setManualInput] = useState(true);

  const loanAssetChain = LoanAssetHelper.toChain(loanAsset);

  let warning = "";
  if (manualInput) {
    warning = `Provide a valid address on the ${loanAssetChain} network. Providing an incorrect address here will lead to loss of funds.`;
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    setManualInput(true);
    setHideButton(false);
    setLoanAddress(e.target.value);
  }

  const onAddressFetched = (address: string) => {
    setLoanAddress(address);
    setHideButton(true);
    setManualInput(false);
  };

  // WalletConnect extension only supports Ethereum and Ethereum-L2s... No Starknet
  const isStarknet =
    loanAsset === LoanAsset.USDT_SN || loanAsset === LoanAsset.USDC_SN;
  // WalletConnect does not support Solana at this point of time
  const isSolana =
    loanAsset === LoanAsset.USDT_SOL || loanAsset === LoanAsset.USDC_SOL;
  // WalletConnect does not support Liquid at this point of time
  const isLiquid = loanAsset === LoanAsset.USDT_Liquid;

  return (
    <Flex direction={"column"} gap={"2"} className="w-full">
      {warning && renderWarning && (
        <Box>
          <Callout.Root color="amber" className="mb-3">
            <Callout.Icon>
              <FontAwesomeIcon icon={faInfoCircle} />
            </Callout.Icon>
            <Callout.Text>{warning}</Callout.Text>
          </Callout.Root>
        </Box>
      )}

      <TextField.Root
        className="text-font dark:text-font-dark flex w-full items-center border-0 font-semibold"
        size={"3"}
        variant="surface"
        placeholder="Enter a valid address"
        type="text"
        value={loanAddress}
        onChange={onInputChange}
      >
        {!isStarknet && !isSolana && !isLiquid && !hideButton && (
          <TextField.Slot side={"right"}>
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
                            variant="solid"
                            size={"1"}
                            className="rounded-lg"
                            color={"blue"}
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
                            variant="solid"
                            size={"1"}
                            className="rounded-lg"
                            color={"blue"}
                            onClick={openChainModal}
                            type="button"
                          >
                            Wrong network
                          </Button>
                        );
                      }

                      return (
                        <Button
                          variant="solid"
                          size={"1"}
                          className="rounded-lg"
                          color={"blue"}
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
          </TextField.Slot>
        )}
        {isStarknet && !hideButton && (
          <Button
            variant="solid"
            size={"1"}
            className="rounded-lg"
            color={"blue"}
            type={"button"}
            onClick={async () => {
              const { wallet, connectorData } = await connect({});
              console.log(`Wallet name : ${wallet?.name}`);
              console.log(`Account: ${connectorData?.account}`);
              if (connectorData?.account) {
                onAddressFetched(connectorData?.account);
              }
            }}
          >
            Get Address
          </Button>
        )}
      </TextField.Root>
    </Flex>
  );
}
