import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSDK } from "@metamask/sdk-react";
import { Button, Callout, TextField } from "@radix-ui/themes";
import React, { useState } from "react";

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
  const { sdk, connected, chainId, provider } = useSDK();

  const [hideButton, setHideButton] = useState(false);
  const [manualInput, setManualInput] = useState(true);

  const connect = async () => {
    try {
      setManualInput(false);
      const accounts = await sdk?.connect();
      setLoanAddress(accounts?.[0] ?? "");
      setHideButton(true);
    } catch (err) {
      console.warn("failed to connect..", err);
    }
  };

  if (provider) {
    function handleChainChanged() {
      window.location.reload();
    }
    provider.on("chainChanged", handleChainChanged);
  }

  let warning = "";
  if (manualInput) {
    warning =
      `Provide a valid address on the ${assetChain} network. Providing an incorrect address here will lead to loss of funds.`;
  }

  switch (assetChain) {
    case "Ethereum":
      if (chainId && chainId !== "0x1") {
        warning = "Please check the selected network in the extension.";
      }
      break;
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setManualInput(true);
    setLoanAddress(e.target.value);
  }

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
        {!connected && (
          <TextField.Slot side={"right"}>
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
              onClick={async () => {
                await connect();
              }}
            >
              Connect Wallet
            </Button>
          </TextField.Slot>
        )}
        {connected && !hideButton && (
          <TextField.Slot side={"right"}>
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
              onClick={async () => {
                await connect();
              }}
            >
              Get Address
            </Button>
          </TextField.Slot>
        )}
      </TextField.Root>
    </>
  );
}
