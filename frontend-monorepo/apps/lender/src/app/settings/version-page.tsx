import { useBaseHttpClient } from "@frontend/base-http-client";
import { VersionInfo } from "@frontend/ui-shared";
import { Box, Heading } from "@radix-ui/themes";

export function VersionPage() {
  const { getVersion } = useBaseHttpClient();

  return (
    <Box className="md:pl-8">
      <Heading
        as="h4"
        className="text-font dark:text-font-dark font-semibold"
        size={"5"}
      >
        Build Version
      </Heading>
      <Box mt={"6"} className="space-y-4">
        <Box className="rounded-2xl border border-purple-400/20 px-5 py-6 dark:border-gray-500/50">
          <VersionInfo getVersion={getVersion} />
        </Box>
      </Box>
    </Box>
  );
}
