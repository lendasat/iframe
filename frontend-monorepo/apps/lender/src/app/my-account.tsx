import { CreateWalletModal, UnlockWalletModal, useWallet } from "@frontend-monorepo/borrower-wallet";
import { Box, Button, Flex, Heading, Separator, Tabs, Text } from "@radix-ui/themes";
import { useState } from "react";
import { GiPadlock, GiPadlockOpen } from "react-icons/gi";
import { PiWarningCircleFill } from "react-icons/pi";

function MyAccount() {
  const layout = window;

  return (
    <Box
      className="p-4 flex flex-col overflow-y-scroll"
      style={{
        height: layout.innerHeight - 120,
      }}
    >
      <Box className="bg-dashboard/50 rounded-2xl shadow-sm flex-grow md:max-h-[800px]">
        <Tabs.Root
          activationMode="manual"
          defaultValue="security"
          className="md:flex md:items-start p-5 h-full"
        >
          <Box className="md:h-full md:border-r md:border-black/5 bg-purple-800/5 p-2 md:p-0 rounded-full md:rounded-none md:bg-transparent md:max-w-[200px] w-full">
            <Tabs.List
              color="purple"
              className="border-b-0 shadow-none md:flex-col rounded-r-full md:rounded-none"
            >
              {["security"].map((items, index) => (
                <Tabs.Trigger
                  key={index}
                  className={`md:justify-start data-[state=active]:before:bg-transparent flex-grow md:w-fit px-2 rounded-full */hover:bg-transparent ${
                    items === "delete account"
                      ? "text-red-600 data-[state=active]:bg-red-600/20 md:mt-8"
                      : "data-[state=inactive]:text-font/70 data-[state=active]:text-purple-800 data-[state=active]:bg-purple-800/20"
                  } font-medium data-[state=active]:font-semibold capitalize`}
                  value={items}
                >
                  {items}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Box>
          <Box pt="3" className="flex-grow">
            <Tabs.Content value="security">
              <Box className="md:pl-8">
                <MnemonicDisplay />
              </Box>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
      <Box py={"3"} mb={"8"}>
        <Flex gap={"1"} align={"center"}>
          <PiWarningCircleFill color="rgb(235, 172, 14)" size={22} />
          <Text size={"1"} weight={"medium"} className="text-font/60">
            Do not disclose your password or seed phrase with anyone, including Lendasat support.
          </Text>
        </Flex>
      </Box>
      <Box>
      </Box>
    </Box>
  );
}

const MnemonicDisplay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const [mnemonic, setMnemonic] = useState("");

  const { doesWalletExist, isWalletLoaded, getMnemonic } = useWallet();

  const onEyeButtonClick = async () => {
    if (!doesWalletExist) {
      handleOpenCreateWalletModal();
      return;
    }
    if (!isWalletLoaded) {
      handleOpenUnlockWalletModal();
      return;
    }

    if (isWalletLoaded && !isVisible) {
      await handleGetMnemonic();
    }
    setIsVisible(!isVisible);
  };

  const handleGetMnemonic = async () => {
    try {
      if (isWalletLoaded) {
        const mnemonicValue = getMnemonic();
        setMnemonic(mnemonicValue);
      }
    } catch (e) {
      alert(e);
    }
  };

  const handleCloseCreateWalletModal = () => setShowCreateWalletModal(false);
  const handleOpenCreateWalletModal = () => setShowCreateWalletModal(true);
  const handleSubmitCreateWalletModal = async () => {
    handleCloseCreateWalletModal();
    await handleGetMnemonic();
  };

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
    await handleGetMnemonic();
  };

  return (
    <Box>
      <Box className="md:w-1/2">
        <Heading as="h4" className="font-semibold" size={"5"}>Seed phrase</Heading>
        <Box mt={"6"} className="space-y-4">
          <CreateWalletModal
            show={showCreateWalletModal}
            handleClose={handleCloseCreateWalletModal}
            handleSubmit={handleSubmitCreateWalletModal}
          />
          <UnlockWalletModal
            show={showUnlockWalletModal}
            handleClose={handleCloseUnlockWalletModal}
            handleSubmit={handleSubmitUnlockWalletModal}
          />
          <Box>
            <Flex direction={"column"} gap={"2"}>
              <Text as="label" weight={"medium"} size={"2"} className="text-font/50">
                Mnemonic Seed Phrase
              </Text>
              <Text size={"3"} weight={"medium"} className="text-font-dark">
                {isVisible
                  ? mnemonic
                  : "● ● ● ● ● ● ● ● ● ● ● ●"}
              </Text>
            </Flex>
          </Box>
          <Separator size={"4"} />
          <Button
            size={"3"}
            onClick={onEyeButtonClick}
            className="bg-btn text-sm"
          >
            {isVisible ? <GiPadlock /> : <GiPadlockOpen />}
            {isVisible ? "Hide phrase" : "Open phrase"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default MyAccount;
