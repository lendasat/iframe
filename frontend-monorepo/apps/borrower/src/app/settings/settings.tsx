import { Box, Flex, TabNav, Text } from "@radix-ui/themes";
import { PiWarningCircleFill } from "react-icons/pi";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Profile } from "./profile";
import { Wallet } from "./wallet";

function Settings() {
  const location = useLocation();

  return (
    <Box className="p-4 flex flex-col overflow-y-scroll">
      <Box className="bg-dashboard/50 dark:bg-dark-700/50 rounded-2xl shadow-sm flex-grow md:max-h-[800px]">
        <TabNav.Root
          className="flex flex-col md:flex md:flex-row md:items-start p-5 h-full"
          color={"purple"}
        >
          <Box className="flex md:flex-col md:h-full md:border-r md:border-black/5 dark:border-dark bg-purple-800/5 p-2 rounded-full md:rounded-none md:bg-transparent md:max-w-[200px] w-full mb-4 md:mb-0">
            <Box className="flex md:flex-col w-full border-b-0 shadow-none rounded-r-full md:rounded-none gap-2">
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
                className="flex-1 md:flex-none text-center md:text-left px-4 py-2 md:py-3 rounded-full hover:bg-transparent font-medium data-[state=active]:font-semibold capitalize data-[state=inactive]:text-font/70 data-[state=active]:text-purple-800 data-[state=active]:bg-purple-800/20 dark:data-[state=inactive]:text-gray-400 dark:data-[state=active]:text-purple-300 dark:data-[state=active]:bg-purple-700/20"
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
