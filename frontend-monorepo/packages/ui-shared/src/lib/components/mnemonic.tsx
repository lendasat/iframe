import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import * as Checkbox from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import * as Label from "@radix-ui/react-label";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  IconButton,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { FaLockOpen, FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { FaLock } from "react-icons/fa6";

export const MnemonicComponent = () => {
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const [hasBackedUp, setHasBackedUp] = useState(false);
  console.log(`Has it backed up ${hasBackedUp}`);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const [isMnemonicVisible, setIsMnemonicVisible] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [isCheckboxTicked, setIsCheckboxTicked] = useState(false);

  const { getMnemonic, isWalletLoaded } = useWallet();

  useEffect(() => {
    const storedBackup = localStorage.getItem("mnemonicBackedUp");
    if (storedBackup) {
      setHasBackedUp(JSON.parse(storedBackup));
    }
  }, []);

  useEffect(() => {
    if (isWalletLoaded) {
      const mnem = getMnemonic();
      setMnemonic(mnem.split(" "));
    }
  }, [isWalletLoaded, getMnemonic]);

  const handleBackupConfirm = () => {
    localStorage.setItem("mnemonicBackedUp", JSON.stringify(true));
    setHasBackedUp(true);
    setIsMnemonicVisible(false);
  };

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
            <Flex direction={"row"} gap={"4"}>
              <Heading
                as="h4"
                className="text-font dark:text-font-dark font-semibold capitalize"
                size={"3"}
              >
                Mnemonic Seed Phrase
              </Heading>

              <IconButton
                variant="ghost"
                type="button"
                className="text-font dark:text-font-dark hover:bg-transparent"
                onClick={unlockWallet}
              >
                {isWalletLoaded ? <FaLockOpen /> : <FaLock />}
              </IconButton>
              {mnemonic.length > 0 && (
                <IconButton
                  variant="ghost"
                  type="button"
                  className="text-font dark:text-font-dark hover:bg-transparent"
                  onClick={() => setIsMnemonicVisible(!isMnemonicVisible)}
                >
                  {isMnemonicVisible ? <FaRegEye /> : <FaRegEyeSlash />}
                </IconButton>
              )}
            </Flex>
            <Grid
              columns={"2"}
              gap={"4"}
              className={"max-w-lg p-4"}
              rows="repeat(6, 1fr)"
              flow={"column"}
            >
              {mnemonic.map((word, index) => (
                <div key={index} className="group flex items-center gap-3">
                  <Label.Root className="flex w-full cursor-text items-center gap-3 border-b border-gray-200 pb-2">
                    <Text
                      size={"3"}
                      weight={"medium"}
                      className="text-font/60 dark:text-font-dark/60 text-gray-400"
                    >
                      {index + 1}.
                    </Text>
                    <Text
                      size={"3"}
                      weight={"medium"}
                      className="text-font/60 dark:text-font-dark/60"
                    >
                      {isMnemonicVisible ? word : "****"}
                    </Text>
                  </Label.Root>
                </div>
              ))}
            </Grid>

            {isWalletLoaded && isMnemonicVisible && !hasBackedUp && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox.Root
                      className="hover:bg-violet3 flex size-[25px] appearance-none items-center justify-center rounded bg-white shadow-[0_1px_5px] outline-none focus:shadow-[0_0_0_2px_black]"
                      disabled={!isMnemonicVisible}
                      checked={isCheckboxTicked}
                      onCheckedChange={(change) =>
                        setIsCheckboxTicked(change === true)
                      }
                      id="backup"
                    >
                      <Checkbox.Indicator className="text-violet11">
                        <CheckIcon />
                      </Checkbox.Indicator>
                    </Checkbox.Root>

                    <label
                      htmlFor="backup"
                      className="text-font/60 dark:text-font-dark/60 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I've created a secure backup
                    </label>
                  </div>

                  <Button
                    onClick={handleBackupConfirm}
                    disabled={!isMnemonicVisible || !isCheckboxTicked}
                    size="2"
                  >
                    Confirm Backup
                  </Button>
                </div>
              </div>
            )}
          </Flex>
        </Box>
      </Box>
    </>
  );
};
