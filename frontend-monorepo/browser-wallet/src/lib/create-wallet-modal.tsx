import { useEffect, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";

import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Flex, Heading, IconButton, Text, TextField } from "@radix-ui/themes";
import { MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";
import { useWallet } from "./browser-wallet";
import { delay } from "./unlock-wallet-modal";

interface WalletModalProps {
  show: boolean;
  handleClose: () => void;
  handleSubmit: (password: string) => void;
}

export function CreateWalletModal({ show, handleClose, handleSubmit }: WalletModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passVisibility, setPassVisibility] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { doesWalletExist, createWallet } = useWallet();

  useEffect(() => {
    if (show) {
      // Reset all states when the modal is shown
      setPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [show]); // This effect runs every time 'show' changes

  const validatePasswords = () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    setError("");
    return true;
  };

  const onOkClick = async () => {
    setLoading(true);
    await delay(100);
    if (validatePasswords()) {
      try {
        if (!doesWalletExist) {
          createWallet(password, import.meta.env.VITE_BITCOIN_NETWORK ?? "signet");
          console.log("Created new wallet");
        } else {
          setError("Wallet already exists, please unlock instead");
          return;
        }
      } catch (error) {
        setError(`${JSON.stringify(error)}`);
        return;
      } finally {
        setLoading(false);
      }

      handleSubmit(password);
      handleClose();
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Box className="px-4 pt-7">
        <Box>
          <Heading as="h2" className="text-xl md:text-2xl lg:text-3xl font-semibold text-center text-font-dark mb-7">
            Create Contract Secret
          </Heading>
        </Box>
        <Box className="mb-3">
          <Flex className="flex flex-col gap-3">
            {(!error)
              ? (
                <Alert variant={"info"} className="flex items-start gap-2">
                  <Box>
                    <FontAwesomeIcon icon={faInfoCircle} />
                  </Box>
                  <Text>
                    Please enter a secret for your contracts. Keep this password safe. You will need it when unlocking
                    your funds.
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
        <Box className="mb-4">
          <TextField.Root
            variant="soft"
            className="py-3 px-4 rounded-lg border border-font/10"
            placeholder="Enter Contract Secret"
            type={passVisibility ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          >
            <TextField.Slot />
            <TextField.Slot>
              <IconButton variant="ghost" onClick={() => setPassVisibility(!passVisibility)}>
                {passVisibility
                  ? <MdOutlineVisibilityOff size={24} className="text-font/50" />
                  : <MdOutlineVisibility size={24} className="text-font/50" />}
              </IconButton>
            </TextField.Slot>
          </TextField.Root>
        </Box>
        <Box>
          <TextField.Root
            variant="soft"
            className="py-3 px-4 rounded-lg border border-font/10"
            placeholder="Confirm Secret Pin"
            type={passVisibility ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          >
            <TextField.Slot />
            <TextField.Slot>
              <IconButton variant="ghost" onClick={() => setPassVisibility(!passVisibility)}>
                {passVisibility
                  ? <MdOutlineVisibilityOff size={24} className="text-font/50" />
                  : <MdOutlineVisibility size={24} className="text-font/50" />}
              </IconButton>
            </TextField.Slot>
          </TextField.Root>
        </Box>
      </Box>
      <Box className="mt-4 px-4 pb-5">
        <Button
          variant="solid"
          className={`w-full h-12 ${loading ? "bg-btn/5" : "bg-btn text-white"} rounded-lg `}
          onClick={onOkClick}
          disabled={loading}
        >
          {loading ? "Loading…" : "Submit"}
        </Button>
      </Box>
    </Modal>
  );
}
