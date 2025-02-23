import { useBaseHttpClient } from "@frontend/base-http-client";
import { useAuth, useLenderHttpClient } from "@frontend/http-client-lender";
import { EditableTimezoneField, MnemonicComponent } from "@frontend/ui-shared";
import {
  Avatar,
  Box,
  Button,
  Callout,
  Flex,
  Heading,
  Spinner,
  TabNav,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { BiSolidError } from "react-icons/bi";
import { GoVerified } from "react-icons/go";
import { IoIosUnlock } from "react-icons/io";
import { IoInformationCircleOutline } from "react-icons/io5";
import { MdEdit } from "react-icons/md";
import { PiWarningCircleFill } from "react-icons/pi";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import TelegramBotDetails from "./settings/TelegramBotDetails";

function Wallet() {
  return (
    <Box className="md:pl-8">
      <Heading
        as="h4"
        className="text-font dark:text-font-dark font-semibold"
        size={"5"}
      >
        Wallet
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <MnemonicComponent />
        </Box>
      </Box>
    </Box>
  );
}

function Profile() {
  const { user } = useAuth();
  const { forgotPassword } = useBaseHttpClient();
  const { putUpdateProfile } = useLenderHttpClient();
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
      <Heading
        as="h4"
        className="text-font dark:text-font-dark font-semibold"
        size={"5"}
      >
        Profile
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box
          p={"4"}
          className="rounded-2xl border border-purple-400/20 dark:border-gray-500/50"
        >
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
                className="text-font dark:text-font-dark capitalize"
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
                  <Text size={"1"} weight={"medium"} color="green">
                    Verified
                  </Text>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Box>

        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="text-font dark:text-font-dark font-semibold capitalize"
            size={"3"}
          >
            Personal information
          </Heading>
          <Box mt={"4"} className="grid max-w-lg gap-5 md:grid-cols-2">
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark capitalize"
                >
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark"
                >
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
                  <Text
                    size={"3"}
                    weight={"medium"}
                    className="text-font dark:text-font-dark capitalize"
                  >
                    ********
                  </Text>
                  <Button
                    size={"1"}
                    onClick={handleResetPassword}
                    disabled={isLoading}
                    className="bg-btn text-sm dark:bg-gray-900"
                  >
                    {isLoading ? <Spinner size={"1"} /> : <MdEdit />}
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
                  Timezone
                </Text>
                <EditableTimezoneField
                  onSave={async (newVal) => {
                    await putUpdateProfile({
                      timezone: newVal,
                    });
                  }}
                  initialValue={user.timezone}
                />
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark capitalize"
                >
                  {new Date(user.created_at).toLocaleDateString(
                    "en-CA",
                    options,
                  )}
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
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {success && (
          <Callout.Root color="green">
            <Callout.Icon>
              <IoIosUnlock />
            </Callout.Icon>
            <Callout.Text>{success}</Callout.Text>
          </Callout.Root>
        )}
      </Box>
    </Box>
  );
}

function NotificationSettings() {
  const { user } = useAuth();

  const maybeBotUrl = import.meta.env.VITE_TELEGRAM_BOT_URL;
  const maybeBotName = import.meta.env.VITE_TELEGRAM_BOT_NAME;
  const maybePersonalTelegramToken = user?.personal_telegram_token;

  let error = false;
  if (!maybeBotUrl || !maybeBotName || !maybePersonalTelegramToken) {
    error = true;
  }

  console.log(maybeBotUrl);
  console.log(maybeBotName);
  console.log(maybePersonalTelegramToken);

  const botUrl = maybeBotUrl || "";
  const botName = maybeBotName || "";
  const personalTelegramToken = maybePersonalTelegramToken || "";

  return (
    <Box className="md:pl-8">
      <Heading
        as="h4"
        className="text-font dark:text-font-dark font-semibold"
        size={"5"}
      >
        Notification Settings
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <Heading
            as="h4"
            className="text-font dark:text-font-dark font-semibold capitalize"
            size={"3"}
          >
            Telegram Bot
          </Heading>
          {error ? (
            <Callout.Root color="orange">
              <Callout.Icon>
                <IoInformationCircleOutline />
              </Callout.Icon>
              <Callout.Text>
                Telegram bot has not been configured correctly
              </Callout.Text>
            </Callout.Root>
          ) : (
            <Box mt={"4"} className="w-full">
              <TelegramBotDetails
                token={personalTelegramToken}
                botUrl={botUrl}
                botName={botName}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function MyAccount() {
  const location = useLocation();

  return (
    <Box className="flex flex-col overflow-y-scroll p-4">
      <Box className="bg-dashboard/50 dark:bg-dark-700/50 flex-grow rounded-2xl shadow-sm md:max-h-[800px]">
        <TabNav.Root
          className="h-full p-5 md:flex md:items-start"
          color={"purple"}
        >
          <Box className="dark:border-dark w-full rounded-full bg-purple-800/5 p-2 md:h-full md:max-w-[200px] md:rounded-none md:border-r md:border-black/5 md:bg-transparent md:p-0">
            <Box className="rounded-r-full border-b-0 shadow-none md:flex-col md:rounded-none">
              <TabNav.Link
                asChild
                active={location.pathname.includes("profile")}
                className="data-[state=inactive]:text-font/70 flex-1 rounded-full px-4 py-2 text-center font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 md:flex-none md:py-3 md:text-left dark:data-[state=active]:bg-purple-700/20 dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400"
              >
                <Link className={"text-font dark:text-font-dark"} to="profile">
                  Profile
                </Link>
              </TabNav.Link>
              <TabNav.Link
                asChild
                active={location.pathname.includes("wallet")}
                className={`"data-[state=inactive]:text-font/70 dark:data-[state=active]:bg-purple-700/20" flex-grow rounded-full px-2 font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 data-[state=active]:before:bg-transparent md:w-fit md:justify-start dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400`}
              >
                <Link className={"text-font dark:text-font-dark"} to="wallet">
                  Wallet
                </Link>
              </TabNav.Link>
              <TabNav.Link
                asChild
                active={location.pathname.includes("notifications")}
                className={`"data-[state=inactive]:text-font/70 dark:data-[state=active]:bg-purple-700/20" flex-grow rounded-full px-2 font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 data-[state=active]:before:bg-transparent md:w-fit md:justify-start dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400`}
              >
                <Link
                  className={"text-font dark:text-font-dark"}
                  to="notifications"
                >
                  Notification Settings
                </Link>
              </TabNav.Link>
            </Box>
          </Box>
          <Box pt="3" className="flex-grow">
            <Routes>
              <Route path="/" element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="notifications" element={<NotificationSettings />} />
            </Routes>
          </Box>
        </TabNav.Root>
      </Box>
      <Box py={"3"} mb={"8"}>
        <Flex gap={"1"} align={"center"}>
          <PiWarningCircleFill color="rgb(235, 172, 14)" size={22} />
          <Text
            size={"1"}
            weight={"medium"}
            className="text-font/60 dark:text-font-dark/60"
          >
            Do not disclose your password to anyone, including Lendasat support.
          </Text>
        </Flex>
      </Box>
      <Box></Box>
    </Box>
  );
}

export default MyAccount;
