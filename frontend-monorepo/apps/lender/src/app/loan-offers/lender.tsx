import type { LenderProfile } from "@frontend-monorepo/http-client-borrower";
import { Avatar, Box, Flex, Text } from "@radix-ui/themes";

export function Lender({ name, id }: LenderProfile) {
  return (
    <Box asChild>
      <Flex direction={"row"} align={"center"} gap={"3"}>
        <Avatar
          radius="full"
          color="purple"
          size={"1"}
          fallback={name.substring(0, 1)}
        />
        <Text className={"text-font dark:text-font-dark"} size={"1"} weight={"medium"}>
          {name}
        </Text>
      </Flex>
    </Box>
  );
}
