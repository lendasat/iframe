import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, TextField } from "@radix-ui/themes";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { connect } from "starknetkit";

interface LoanAddressInputFieldProps {
  loanAddress: string;
  setLoanAddress: (value: string) => void;
  assetChain: string;
  hideButton: boolean;
  setHideButton: (value: boolean) => void;
}

export function LoanAddressInputField({
  loanAddress,
  setLoanAddress,
  assetChain,
  hideButton,
  setHideButton,
}: LoanAddressInputFieldProps) {
  const [manualInput, setManualInput] = useState(true);

  let warning = "";
  if (manualInput) {
    warning =
      `Provide a valid address on the ${assetChain} network. Providing an incorrect address here will lead to loss of funds.`;
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
  const isStarknet = assetChain.toLowerCase() === "starknet";

  return (
    <>
      {warning
        && (
          <Callout.Root color="amber">
            <Callout.Icon>
              <FontAwesomeIcon icon={faInfoCircle} />
            </Callout.Icon>
            <Callout.Text>
              {warning}
            </Callout.Text>
          </Callout.Root>
        )}

      <TextField.Root
        className="w-full font-semibold border-0 flex items-center"
        size={"3"}
        variant="surface"
        color={"gray"}
        placeholder="Enter a valid address"
        type="text"
        value={loanAddress}
        onChange={onInputChange}
      >
        {!isStarknet && !hideButton && (
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
                      "style": {
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
    </>
  );
}
