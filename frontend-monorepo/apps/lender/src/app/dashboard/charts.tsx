import { Box, Heading, Tabs } from "@radix-ui/themes";
import { TabHeader } from "./dashoard-contracts";

export function Charts() {
  return (
    <Box className="min-h-96 space-y-4">
      <Heading className="mb-4 text-black dark:text-white">Charts</Heading>

      <Tabs.Root defaultValue="tab1" orientation="vertical" className="flex">
        <Tabs.List className="dark:bg-dark-500 dark:border-dark-600 flex min-w-[200px] shrink-0 flex-col items-center gap-1 space-y-2 rounded-xl border border-r border-gray-200 bg-white p-4">
          <TabHeader thisIndex={"tab1"} label={"Interest Rates"} />
          <TabHeader thisIndex={"tab2"} label={"..."} />
        </Tabs.List>

        {/* Tab Content */}
        <div className="flex-1 p-4">
          <Tabs.Content value="tab1" className="outline-none">
            <h3 className="text-lg font-medium">Content 1</h3>
            <p>This is the content for tab 1.</p>
          </Tabs.Content>
          <Tabs.Content value="tab2" className="outline-none">
            <h3 className="text-lg font-medium">Content 2</h3>
            <p>This is the content for tab 2.</p>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </Box>
  );
}
