import { Box, Flex, TabNav, Text } from "@radix-ui/themes";
import { PiWarningCircleFill } from "react-icons/pi";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Profile } from "./profile";
import { Wallet } from "./wallet";
import { NostrChatSettingsPage } from "./nostr-chat-settings";
import { NotificationSettings } from "./notification-settings";
import { VersionPage } from "./version-page";

function Settings() {
  const location = useLocation();

  return (
    <Box className="flex flex-col overflow-y-scroll p-4">
      <Box className="bg-dashboard/50 dark:bg-dark-700/50 flex-grow rounded-2xl shadow-sm md:max-h-[800px]">
        <TabNav.Root
          className="flex h-full flex-col p-5 md:flex md:flex-row md:items-start"
          color={"purple"}
        >
          <Box className="dark:border-dark mb-4 flex w-full rounded-full bg-purple-800/5 p-2 md:mb-0 md:h-full md:max-w-[200px] md:flex-col md:rounded-none md:border-r md:border-black/5 md:bg-transparent">
            <Box className="flex w-full gap-2 rounded-r-full border-b-0 shadow-none md:flex-col md:rounded-none">
              <TabNav.Link
                asChild
                active={location.pathname.includes("profile")}
                className="data-[state=inactive]:text-font/70 flex-1 rounded-full px-4 py-2 text-center font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 md:flex-none md:py-3 md:text-left dark:data-[state=active]:bg-purple-700/20 dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400"
              >
                <Link to="profile">Profile</Link>
              </TabNav.Link>
              <TabNav.Link
                asChild
                active={location.pathname.includes("wallet")}
                className="data-[state=inactive]:text-font/70 flex-1 rounded-full px-4 py-2 text-center font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 md:flex-none md:py-3 md:text-left dark:data-[state=active]:bg-purple-700/20 dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400"
              >
                <Link to="wallet">Wallet</Link>
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
              <TabNav.Link
                asChild
                active={location.pathname.includes("chat")}
                className="data-[state=inactive]:text-font/70 flex-1 rounded-full px-4 py-2 text-center font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 md:flex-none md:py-3 md:text-left dark:data-[state=active]:bg-purple-700/20 dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400"
              >
                <Link to="chat">Chat (Nostr)</Link>
              </TabNav.Link>
              <TabNav.Link
                asChild
                active={location.pathname.includes("version")}
                className="data-[state=inactive]:text-font/70 flex-1 rounded-full px-4 py-2 text-center font-medium capitalize hover:bg-transparent data-[state=active]:bg-purple-800/20 data-[state=active]:font-semibold data-[state=active]:text-purple-800 md:flex-none md:py-3 md:text-left dark:data-[state=active]:bg-purple-700/20 dark:data-[state=active]:text-purple-300 dark:data-[state=inactive]:text-gray-400"
              >
                <Link to="version">Version Info</Link>
              </TabNav.Link>
            </Box>
          </Box>
          <Box pt="3" className="flex-grow">
            <Routes>
              <Route path="/" element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="chat" element={<NostrChatSettingsPage />} />
              <Route path="version" element={<VersionPage />} />
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
    </Box>
  );
}

export default Settings;
