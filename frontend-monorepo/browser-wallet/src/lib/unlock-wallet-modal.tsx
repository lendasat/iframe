import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, Flex, Heading, IconButton, Text, TextField } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Alert, Modal } from "react-bootstrap";
import { MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";
import { useWallet } from "./browser-wallet";

interface WalletModalProps {
  show: boolean;
  handleClose: () => void;
  handleSubmit: () => void;
}

export function UnlockWalletModal({ show, handleClose, handleSubmit }: WalletModalProps) {
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
    <Modal show={show} onHide={handleClose} centered>
      <Box className={"bg-white dark:bg-dark-700 rounded-2"}>
        <Box className="px-4 pt-7">
          <Box>
            <Heading
              as="h2"
              className="text-xl md:text-2xl lg:text-4xl font-semibold text-center text-font dark:text-font-dark mb-7"
            >
              Input Password
            </Heading>
          </Box>
          <Box className="mb-3">
            <Flex className="flex flex-col gap-3">
              {(!error)
                ? (
                  <Alert variant={"info"} className="flex items-baseline gap-2">
                    <Box>
                      <FontAwesomeIcon icon={faInfoCircle} />
                    </Box>
                    <Text>
                      Please provide your password. It is needed to access your encrypted contract data.
                    </Text>
                  </Alert>
                )
                : ""}
              {error
                && (
                  <Alert variant={"danger"} className="flex items-start gap-2">
                    <Box>
                      <FontAwesomeIcon icon={faInfoCircle} />
                    </Box>
                    <Text>{error}</Text>
                  </Alert>
                )}
            </Flex>
          </Box>
          <Box>
            <TextField.Root
              variant="soft"
              className="py-3 px-4 rounded-lg border border-font/10 dark:border-font-dark/10 text-font dark:text-font-dark"
              placeholder="Enter Password"
              type={passVisibility ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            >
              <TextField.Slot />
              <TextField.Slot>
                <IconButton variant="ghost" onClick={() => setPassVisibility(!passVisibility)}>
                  {passVisibility
                    ? <MdOutlineVisibilityOff size={24} className="text-font/50 dark:text-font-dark/50" />
                    : <MdOutlineVisibility size={24} className="text-font/50 dark:text-font-dark/50" />}
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </Box>
        <Box className="mt-4 px-4 pb-5 bg-white dark:bg-dark-700 rounded-2">
          <Button
            variant="solid"
            className={`w-full h-12 ${loading ? "bg-btn/5" : "bg-btn text-white"} rounded-lg `}
            onClick={onOkClick}
            disabled={loading}
          >
            {loading ? "Loading…" : "Submit"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
