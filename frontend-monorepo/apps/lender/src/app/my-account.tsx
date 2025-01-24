import { MnemonicComponent } from "@frontend-monorepo/ui-shared";
import { Box, Flex, Heading, TabNav, Text } from "@radix-ui/themes";
import { PiWarningCircleFill } from "react-icons/pi";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

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
              <Route path="/" element={<Navigate to="wallet" replace />} />
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
