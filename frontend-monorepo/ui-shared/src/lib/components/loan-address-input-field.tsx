import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import React, { useState } from "react";
import { connect } from "starknetkit";

interface LoanAddressInputFieldProps {
  loanAddress: string;
  setLoanAddress: (value: ((prevState: string) => string) | string) => void;
  assetChain: string;
}

export function LoanAddressInputField({
  loanAddress,
  setLoanAddress,
  assetChain,
}: LoanAddressInputFieldProps) {
  const [hideButton, setHideButton] = useState(false);
  const [manualInput, setManualInput] = useState(true);

  let warning = "";
  if (manualInput) {
    warning =
      `Provide a valid address on the ${assetChain} network. Providing an incorrect address here will lead to loss of funds.`;
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
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
                          <button onClick={openConnectModal} type="button">
                            Connect Wallet
                          </button>
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
            Connect Wallet
          </Button>
        )}
      </TextField.Root>
    </>
  );
}
