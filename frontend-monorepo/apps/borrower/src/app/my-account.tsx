import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { useWallet } from "@frontend-monorepo/borrower-wallet";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { Avatar, Box, Button, Callout, Flex, Heading, Separator, Spinner, Tabs, Text } from "@radix-ui/themes";
import { useState } from "react";
import { BiSolidError } from "react-icons/bi";
import { GiPadlock, GiPadlockOpen } from "react-icons/gi";
import { GoVerified } from "react-icons/go";
import { IoIosUnlock } from "react-icons/io";
import { MdEdit } from "react-icons/md";
import { CreateWalletModal } from "./wallet/create-wallet-modal";
import { UnlockWalletModal } from "./wallet/unlock-wallet-modal";

function MyAccount() {
  const { user } = useAuth();
  const { forgotPassword } = useBaseHttpClient();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const successMsg = await forgotPassword(user?.email ?? "");
      setSuccess(successMsg);
    } catch (err) {
      console.error("Failed resetting password: ", err);
      setError(`Failed resetting password. ${err}`);
    }
    setLoading(false);
  };

  const layout = window;

  // Format date options
  const options: any = {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return (
    <Box
      className="p-4 flex flex-col overflow-y-scroll"
      style={{
        height: layout.innerHeight - 65,
      }}
    >
      <Heading weight={"medium"} mb={"4"}>Account Settings</Heading>
      <Box className="bg-dashboard rounded-3xl shadow-sm flex-grow">
        <Tabs.Root
          activationMode="manual"
          defaultValue="profile"
          className="md:flex md:items-start p-5 h-full"
        >
          <Box className="md:h-full md:border-r md:border-black/5 bg-purple-800/5 p-2 md:p-0 rounded-full md:rounded-none md:bg-transparent md:max-w-[200px] w-full">
            <Tabs.List
              color="purple"
              className="border-b-0 shadow-none md:flex-col rounded-r-full md:rounded-none"
            >
              {["profile", "security"].map((items, index) => (
                <Tabs.Trigger
                  key={index}
                  className={`md:justify-start data-[state=active]:before:bg-transparent flex-grow md:w-fit px-2 rounded-full */hover:bg-transparent ${items === "delete account"
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
            <Tabs.Content value="profile">
              {user
                ? (
                  <Box className="md:pl-8">
                    <Heading as="h4" className="font-semibold" size={"5"}>Profile</Heading>
                    <Box mt={"6"} className="space-y-4">
                      <Box p={"4"} className="border border-purple-400/20 rounded-2xl">
                        <Flex align={"center"} gap={"3"}>
                          <Avatar
                            src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
                            size={"7"}
                            radius="full"
                            color="purple"
                            fallback={user.name.substring(0, 1)}
                          />
                          <Flex align={"start"} direction={"column"} gap={"1"}>
                            <Heading as="h4" weight={"medium"} className="capitalize" size={"4"}>{user.name}</Heading>
                            <Text size={"2"} className="text-font/50">
                              {new Date(user.created_at).toLocaleDateString("en-CA", options)}
                            </Text>
                            {user.verified && (
                              <Flex gap={"1"}>
                                <GoVerified color="green" />
                                <Text size={"1"} weight={"medium"} color="green">Verified</Text>
                              </Flex>
                            )}
                          </Flex>
                        </Flex>
                      </Box>

                      <Box className="border border-purple-400/20 rounded-2xl px-5 py-6">
                        <Heading as="h4" className="font-semibold capitalize" size={"3"}>Personal information</Heading>
                        <Box mt={"4"} className="max-w-lg grid md:grid-cols-2 gap-5">
                          <Box>
                            <Flex direction={"column"} gap={"1"}>
                              <Text as="label" weight={"medium"} size={"2"} className="text-font/50">
                                Full Name
                              </Text>
                              <Text size={"3"} weight={"medium"} className="capitalize text-font-dark">
                                {user.name}
                              </Text>
                            </Flex>
                          </Box>

                          <Box>
                            <Flex direction={"column"} gap={"1"}>
                              <Text as="label" weight={"medium"} size={"2"} className="text-font/50">
                                Email Address
                              </Text>
                              <Text size={"3"} weight={"medium"} className="capitalize text-font-dark">
                                {user.email}
                              </Text>
                            </Flex>
                          </Box>
                          <Box>
                            <Flex direction={"column"} gap={"1"}>
                              <Text as="label" weight={"medium"} size={"2"} className="text-font/50">
                                Password
                              </Text>
                              <Text size={"3"} weight={"medium"} className="capitalize text-font-dark">********</Text>
                            </Flex>
                          </Box>
                          <Box>
                            <Flex direction={"column"} gap={"1"}>
                              <Text as="label" weight={"medium"} size={"2"} className="text-font/50">
                                Joined on
                              </Text>
                              <Text size={"3"} weight={"medium"} className="capitalize text-font-dark">
                                {new Date(user.created_at).toLocaleDateString("en-CA", options)}
                              </Text>
                            </Flex>
                          </Box>
                        </Box>
                      </Box>
                      {error && (
                        <Callout.Root color="red">
                          <Callout.Icon>
                            <BiSolidError />
                          </Callout.Icon>
                          <Callout.Text>
                            {error}
                          </Callout.Text>
                        </Callout.Root>
                      )}

                      {success
                        && (
                          <Callout.Root color="green">
                            <Callout.Icon>
                              <IoIosUnlock />
                            </Callout.Icon>
                            <Callout.Text>
                              {success}
                            </Callout.Text>
                          </Callout.Root>
                        )}

                      <Box pt={"5"}>
                        <Flex justify={"end"}>
                          <Button
                            size={"3"}
                            onClick={handleResetPassword}
                            disabled={isLoading}
                            className="bg-btn text-sm"
                          >
                            {isLoading
                              ? <Spinner size={"3"} />
                              : <MdEdit />}
                            Recover Password
                          </Button>
                        </Flex>
                      </Box>
                    </Box>
                  </Box>
                )
                : (
                  <Box className="px-5">
                    {/* To be worked on */}
                    <div>No user data found.</div>
                  </Box>
                )}
            </Tabs.Content>
            <Tabs.Content value="security">
              <Box className="md:pl-8">
                <MnemonicDisplay />
              </Box>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
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

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleSubmitCreateWalletModal = async () => {
    handleCloseCreateWalletModal();
    await handleGetMnemonic();
  };
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
              <Text size={"3"} weight={"medium"} className="capitalize text-font-dark">
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
