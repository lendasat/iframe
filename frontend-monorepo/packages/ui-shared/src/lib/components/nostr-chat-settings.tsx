import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import { Box, Callout, Code, Flex, Heading } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { FaLockOpen, FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { Keys, loadWasmSync } from "@rust-nostr/nostr-sdk";
import { CopyIcon } from "@radix-ui/react-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FaLock } from "react-icons/fa6";
import { Button } from "@frontend/shadcn";

export const NostrChatSettings = () => {
  const [isNsecVisible, setIsNsecVisible] = useState(false);
  const [nsec, setNsec] = useState<string>("");

  const { getNsec, isWalletLoaded } = useWallet();

  useEffect(() => {
    if (isWalletLoaded) {
      loadWasmSync();
      const nsecHex = getNsec();
      setNsec(nsecHex);
      try {
        const newKeys = Keys.parse(nsecHex);
        console.log(`nsec ${newKeys.secretKey.toBech32()}`);
        setNsec(newKeys.secretKey.toBech32());
      } catch (e) {
        console.error(`Error received: ${e}`);
      }
    }
  }, [isWalletLoaded, getNsec]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(nsec);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <>
      <Box mt={"4"} className="grid max-w-lg gap-5 md:grid-cols-1">
        <Box>
          <Flex direction={"column"} gap={"1"}>
            <Flex direction={"row"} gap={"4"} align={"center"}>
              <Heading
                as="h4"
                className="text-font dark:text-font-dark font-semibold capitalize"
                size={"3"}
              >
                Nsec
              </Heading>

              {!isWalletLoaded ? (
                <UnlockWalletModal handleSubmit={() => {}}>
                  <Button variant="outline" size="icon">
                    <FaLock />
                  </Button>
                </UnlockWalletModal>
              ) : (
                <Button variant="outline" size="icon" disabled={isWalletLoaded}>
                  <FaLockOpen />
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                disabled={!isWalletLoaded}
                onClick={async () => {
                  setIsNsecVisible(!isNsecVisible);
                }}
              >
                {isNsecVisible ? <FaRegEye /> : <FaRegEyeSlash />}
              </Button>
            </Flex>
            <Callout.Root color="blue" size={"2"}>
              <Callout.Icon>
                <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4" />
              </Callout.Icon>
              <Callout.Text wrap={"pretty"}>
                Below you can find your private NSEC (Nostr Private Key). It is
                derived from your seed phrase. You can use this nsec and import
                it in a Nostr Client such as Amethyst on Android or YakiHonne to
                read chat messages.
              </Callout.Text>
            </Callout.Root>
            <Flex direction={"row"} gap={"2"} mt={"4"} align={"center"}>
              <Code>
                {isNsecVisible
                  ? nsec
                  : "*******************************************************************"}
              </Code>
              <Button
                variant="outline"
                size="icon"
                disabled={!isWalletLoaded}
                onClick={async () => {
                  await handleCopy();
                }}
              >
                <CopyIcon />
              </Button>
            </Flex>
          </Flex>
        </Box>
      </Box>
    </>
  );
};
