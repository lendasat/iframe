import { MnemonicComponent } from "@frontend-monorepo/ui-shared";
import { Box, Flex, Heading, Tabs, Text } from "@radix-ui/themes";
import { PiWarningCircleFill } from "react-icons/pi";

function MyAccount() {
  return (
    <>
      <Box
        className="p-4 flex flex-col overflow-y-scroll"
        style={{
          height: window.innerHeight - 120,
        }}
      >
        <Box className="bg-dashboard/50 dark:bg-dark-700/50 rounded-2xl shadow-sm flex-grow md:max-h-[800px]">
          <Tabs.Root
            activationMode="manual"
            defaultValue="wallet"
            className="md:flex md:items-start p-5 h-full"
          >
            <Box className="md:h-full md:border-r md:border-black/5 dark:border-dark bg-purple-800/5 p-2 md:p-0 rounded-full md:rounded-none md:bg-transparent md:max-w-[200px] w-full">
              <Tabs.List
                color="purple"
                className="border-b-0 shadow-none md:flex-col rounded-r-full md:rounded-none"
              >
                {["wallet"].map((items, index) => (
                  <Tabs.Trigger
                    key={index}
                    className={`md:justify-start data-[state=active]:before:bg-transparent flex-grow md:w-fit px-2 rounded-full hover:bg-transparent ${
                      items === "delete account"
                        ? "text-red-600 data-[state=active]:bg-red-600/20 md:mt-8 dark:text-red-400 dark:data-[state=active]:bg-red-800/20"
                        : "data-[state=inactive]:text-font/70 data-[state=active]:text-purple-800 data-[state=active]:bg-purple-800/20 dark:data-[state=inactive]:text-gray-400 dark:data-[state=active]:text-purple-300 dark:data-[state=active]:bg-purple-700/20"
                    } font-medium data-[state=active]:font-semibold capitalize`}
                    value={items}
                  >
                    {items}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Box>
            <Box pt="3" className="flex-grow">
              <Tabs.Content value="wallet">
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
              </Tabs.Content>
            </Box>
          </Tabs.Root>
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
    </>
  );
}

export default MyAccount;
