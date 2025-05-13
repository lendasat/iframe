import { UnlockWalletModal, useWallet } from "@frontend/browser-wallet";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
} from "@frontend/shadcn";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { useEffect, useState } from "react";

export const MnemonicComponent = () => {
  const [hasBackedUp, setHasBackedUp] = useState(false);
  const [isMnemonicVisible, setIsMnemonicVisible] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-1 pt-3">
          <div className="flex justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                Mnemonic seed phrase
              </CardTitle>
              <CardDescription>
                This seed is used to derive the keys that secure loan
                collateral. Back it up!
              </CardDescription>
            </div>

            {!isWalletLoaded ? (
              <UnlockWalletModal
                handleSubmit={() => setIsMnemonicVisible(!isMnemonicVisible)}
                description="Your password is needed to decrypt your wallet and display the mnemonic seed phrase."
              >
                <Button variant="outline" size="icon">
                  <LuEye />
                </Button>
              </UnlockWalletModal>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsMnemonicVisible(!isMnemonicVisible)}
              >
                {isMnemonicVisible ? <LuEyeOff /> : <LuEye />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="mt-4">
          <div
            className="grid max-w-lg px-4"
            style={{
              gridAutoFlow: "column",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "repeat(6, 1fr)",
            }}
          >
            {mnemonic.map((word, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: values are secret.
              <div key={index} className="group flex items-center gap-3">
                <div className="flex w-full items-center gap-3 border-b border-gray-200 pb-2">
                  <span className="text-font/60 dark:text-font-dark/60 text-gray-400 inline-block py-3 select-none">
                    {index + 1}.
                  </span>
                  <span className="text-font/60 dark:text-font-dark/60">
                    {isMnemonicVisible ? word : "****"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!hasBackedUp && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    className="hover:bg-violet3 focus:shadow-outline flex h-[25px] w-[25px] appearance-none items-center justify-center rounded bg-white shadow-md outline-none"
                    disabled={!isMnemonicVisible}
                    checked={isCheckboxTicked}
                    onCheckedChange={(change) =>
                      setIsCheckboxTicked(change === true)
                    }
                    id="backup"
                  ></Checkbox>
                  <label
                    htmlFor="backup"
                    className="text-font/60 dark:text-font-dark/60 text-sm font-medium leading-none"
                  >
                    I've created a secure backup
                  </label>
                </div>
                <Button
                  onClick={handleBackupConfirm}
                  disabled={!isMnemonicVisible || !isCheckboxTicked}
                >
                  Confirm Backup
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
