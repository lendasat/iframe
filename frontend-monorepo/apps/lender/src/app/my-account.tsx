import { MnemonicComponent } from "@frontend-monorepo/ui-shared";
import { Avatar, Box, Button, Callout, Flex, Heading, Spinner, TabNav, Text } from '@radix-ui/themes';
import { PiWarningCircleFill } from "react-icons/pi";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from '@frontend-monorepo/http-client-lender';
import { useBaseHttpClient } from '@frontend-monorepo/base-http-client';
import { useState } from 'react';
import { GoVerified } from 'react-icons/go';
import { BiSolidError } from 'react-icons/bi';
import { IoIosUnlock } from 'react-icons/io';
import { MdEdit } from 'react-icons/md';

function Wallet() {
  return (
    <Box className="md:pl-8">
      <Heading as="h4" className="font-semibold text-font dark:text-font-dark" size={"5"}>
        Wallet
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box className="border border-purple-400/20 rounded-2xl px-5 py-6 dark:border-gray-500/50">
          <MnemonicComponent />
        </Box>
      </Box>
    </Box>
  );
}

function Profile() {
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

  if (!user) {
    return <>This should not happen</>;
  }

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return (
    <Box className="md:pl-8">
      <Heading as="h4" className="font-semibold text-font dark:text-font-dark" size={"5"}>
        Profile
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box p={"4"} className="border border-purple-400/20 rounded-2xl dark:border-gray-500/50">
          <Flex align={"center"} gap={"3"}>
            <Avatar
              src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
              size={"7"}
              radius="full"
              color="purple"
              fallback={user.name.substring(0, 1)}
            />
            <Flex align={"start"} direction={"column"} gap={"1"}>
              <Heading
                as="h4"
                weight={"medium"}
                className="capitalize text-font dark:text-font-dark"
                size={"4"}
              >
                {user.name}
              </Heading>
              <Text size={"2"} className="text-font/50 dark:text-font-dark/50">
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

        <Box className="border border-purple-400/20 rounded-2xl px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="font-semibold capitalize text-font dark:text-font-dark"
            size={"3"}
          >
            Personal information
          </Heading>
          <Box mt={"4"} className="max-w-lg grid md:grid-cols-2 gap-5">
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Full Name
                </Text>
                <Text size={"3"} weight={"medium"} className="capitalize text-font dark:text-font-dark">
                  {user.name}
                </Text>
              </Flex>
            </Box>

            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Email Address
                </Text>
                <Text size={"3"} weight={"medium"} className="text-font dark:text-font-dark">
                  {user.email}
                </Text>
              </Flex>
            </Box>
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Password
                </Text>
                <Flex gap={"3"}>
                  <Text size={"3"} weight={"medium"} className="capitalize text-font dark:text-font-dark">
                    ********
                  </Text>
                  <Button
                    size={"1"}
                    onClick={handleResetPassword}
                    disabled={isLoading}
                    className="bg-btn text-sm dark:bg-gray-900"
                  >
                    {isLoading
                      ? <Spinner size={"1"} />
                      : <MdEdit />}
                  </Button>
                </Flex>
              </Flex>
            </Box>
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Joined on
                </Text>
                <Text size={"3"} weight={"medium"} className="capitalize text-font dark:text-font-dark">
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
      </Box>
    </Box>
  );
}


function MyAccount() {
  const location = useLocation();

  return (
    <Box className="p-4 flex flex-col overflow-y-scroll">
      <Box className="bg-dashboard/50 dark:bg-dark-700/50 rounded-2xl shadow-sm flex-grow md:max-h-[800px]">
        <TabNav.Root className="md:flex md:items-start p-5 h-full" color={"purple"}>
          <Box className="md:h-full md:border-r md:border-black/5 dark:border-dark bg-purple-800/5 p-2 md:p-0 rounded-full md:rounded-none md:bg-transparent md:max-w-[200px] w-full">
            <Box className="border-b-0 shadow-none md:flex-col rounded-r-full md:rounded-none">
              <TabNav.Link
                asChild
                active={location.pathname.includes("profile")}
                className="flex-1 md:flex-none text-center md:text-left px-4 py-2 md:py-3 rounded-full hover:bg-transparent font-medium data-[state=active]:font-semibold capitalize data-[state=inactive]:text-font/70 data-[state=active]:text-purple-800 data-[state=active]:bg-purple-800/20 dark:data-[state=inactive]:text-gray-400 dark:data-[state=active]:text-purple-300 dark:data-[state=active]:bg-purple-700/20"
              >
                <Link to="profile">Profile</Link>
              </TabNav.Link>
              <TabNav.Link
                asChild
                active={location.pathname.includes("wallet")}
                className={`md:justify-start data-[state=active]:before:bg-transparent flex-grow md:w-fit px-2 rounded-full hover:bg-transparent font-medium data-[state=active]:font-semibold capitalize
                  "data-[state=inactive]:text-font/70 data-[state=active]:text-purple-800 data-[state=active]:bg-purple-800/20 dark:data-[state=inactive]:text-gray-400 dark:data-[state=active]:text-purple-300 dark:data-[state=active]:bg-purple-700/20"
                  `}
              >
                <Link to="wallet">Wallet</Link>
              </TabNav.Link>
            </Box>
          </Box>
          <Box pt="3" className="flex-grow">
            <Routes>
              <Route path="/" element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="wallet" element={<Wallet />} />
            </Routes>
          </Box>
        </TabNav.Root>
      </Box>
      <Box py={"3"} mb={"8"}>
        <Flex gap={"1"} align={"center"}>
          <PiWarningCircleFill color="rgb(235, 172, 14)" size={22} />
          <Text size={"1"} weight={"medium"} className="text-font/60 dark:text-font-dark/60">
            Do not disclose your password to anyone, including Lendasat support.
          </Text>
        </Flex>
      </Box>
      <Box>
      </Box>
    </Box>
  );
}

export default MyAccount;
