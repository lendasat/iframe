import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import {
  Box,
  Callout,
  Code,
  Flex,
  Heading,
  IconButton,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { Keys, loadWasmSync } from "@rust-nostr/nostr-sdk";
import { CopyIcon } from "@radix-ui/react-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";

export const NostrChatSettings = () => {
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

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

  const unlockWallet = async () => {
    try {
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
      }
    } catch (err) {
      console.error("Failed unlocking wallet", err);
      throw err;
    }
  };

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
    // setIsNsecVisible(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(nsec);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <>
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />

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

              <IconButton
                variant="ghost"
                type="button"
                className="text-font dark:text-font-dark hover:bg-transparent"
                onClick={async () => {
                  if (!isWalletLoaded) {
                    await unlockWallet();
                  } else {
                    setIsNsecVisible(!isNsecVisible);
                  }
                }}
              >
                {isNsecVisible ? <FaRegEye /> : <FaRegEyeSlash />}
              </IconButton>
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
            <Flex direction={"row"} gap={"2"} mt={"4"}>
              <Code>
                {isNsecVisible
                  ? nsec
                  : "*******************************************************************"}
              </Code>
              <IconButton
                size="1"
                aria-label="Copy value"
                color="gray"
                variant="ghost"
                disabled={!isWalletLoaded}
                onClick={async () => {
                  await handleCopy();
                }}
              >
                <CopyIcon />
              </IconButton>
            </Flex>
          </Flex>
        </Box>
      </Box>
    </>
  );
};
