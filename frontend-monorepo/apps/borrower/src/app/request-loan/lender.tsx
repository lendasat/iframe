import type { LenderProfile } from "@frontend-monorepo/http-client-borrower";
import { Avatar, Box, Flex, Heading } from "@radix-ui/themes";
import { Link } from "react-router-dom";

export function Lender({ name, id }: LenderProfile) {
  return (
    <Box asChild>
      <Link to={`/profile/${id}`}>
        <Flex direction={"row"} align={"center"} gap={"3"}>
          <Avatar
            radius="full"
            color="purple"
            fallback={name.substring(0, 1)}
          />
          <Heading
            as="h6"
            weight={"medium"}
            size={"3"}
            className="capitalize hidden xl:block text-font dark:text-font-dark"
          >
            {name}
          </Heading>
        </Flex>
      </Link>
    </Box>
  );
}
