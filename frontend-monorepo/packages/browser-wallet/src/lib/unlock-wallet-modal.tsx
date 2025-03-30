import { Box, Flex } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";
import { MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";
import { useWallet } from "./browser-wallet";
import {
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from "@frontend/shadcn";
import { FaInfoCircle } from "react-icons/fa";
import { LuLoader } from "react-icons/lu";

interface WalletModalProps {
  show: boolean;
  handleClose: () => void;
  handleSubmit: () => void;
}

export function UnlockWalletModal({
  show,
  handleClose,
  handleSubmit,
}: WalletModalProps) {
  const [password, setPassword] = useState("");
  const [passVisibility, setPassVisibility] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { loadWallet, isWalletLoaded, doesWalletExist } = useWallet();

  useEffect(() => {
    if (show) {
      // Reset all states when the modal is shown
      setPassword("");
      setError("");
    }
  }, [show]); // This effect runs every time 'show' changes

  const onOkClick = async () => {
    setLoading(true);
    await delay(100);
    try {
      if (!doesWalletExist) {
        setError("Wallet does not exist");
        return;
      }
      if (!isWalletLoaded) {
        await loadWallet(password);
        console.log("Wallet loaded successfully");
      } else {
        console.log("Wallet already loaded");
        return;
      }
    } catch (error) {
      setError(`Failed to unlock: ${error}`);
      return;
    } finally {
      setLoading(false);
    }

    handleSubmit();
  };

  return (
    <Dialog open={show} onClose={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Password</DialogTitle>
          <DialogDescription>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onOkClick();
              }}
            >
              <Box className="px-4 pt-7">
                <Box className="mb-3">
                  <Flex className="flex flex-col gap-3">
                    {!error ? (
                      <Alert>
                        <FaInfoCircle className="h-4 w-4" />
                        <AlertDescription>
                          Please provide your password. It is needed to access
                          your encrypted contract data.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      ""
                    )}
                    {error && (
                      <Alert variant="destructive">
                        <FaInfoCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </Flex>
                </Box>
                <Box>
                  <div className="flex w-full items-center space-x-2">
                    <Input
                      type={passVisibility ? "text" : "password"}
                      value={password}
                      placeholder="Enter Password"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      type={"button"}
                      variant="outline"
                      size="icon"
                      onClick={() => setPassVisibility(!passVisibility)}
                    >
                      {passVisibility ? (
                        <MdOutlineVisibilityOff
                          size={24}
                          className="text-font/50 dark:text-font-dark/50"
                        />
                      ) : (
                        <MdOutlineVisibility
                          size={24}
                          className="text-font/50 dark:text-font-dark/50"
                        />
                      )}
                    </Button>
                  </div>
                </Box>
              </Box>
              <Box className="dark:bg-dark-700 rounded-2 mt-4 bg-white px-4 pb-5">
                <Button
                  variant="default"
                  className={`w-full`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <LuLoader className="animate-spin" />
                      Please wait
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </Box>
            </form>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
