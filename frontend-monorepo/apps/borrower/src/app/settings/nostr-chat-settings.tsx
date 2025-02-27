import { NostrChatSettings } from "@frontend/ui-shared";
import { Box, Heading } from "@radix-ui/themes";

export function NostrChatSettingsPage() {
  return (
    <Box className="md:pl-8">
      <Heading
        as="h4"
        className="text-font dark:text-font-dark font-semibold"
        size={"5"}
      >
        Chat Settings
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <NostrChatSettings />
        </Box>
      </Box>
    </Box>
  );
}
