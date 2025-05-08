import { Avatar, Box, Flex, Heading, Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";

interface BorrowerProps {
  id: string;
  name: string;
  successful_contracts: number;
  failed_contracts: number;
  rating: number;
  showAvatar: boolean;
}

export function Borrower({
  name,
  id,
  rating,
  successful_contracts,
  failed_contracts,
  showAvatar,
}: BorrowerProps) {
  let ratingText = (
    <Text
      className={"text-font dark:text-font-dark self-end"}
      size={"1"}
      weight={"light"}
    >
      No rating yet
    </Text>
  );
  if (successful_contracts + failed_contracts > 0) {
    ratingText = (
      <Text
        className={"text-font dark:text-font-dark self-end"}
        size={"1"}
        weight={"light"}
      >
        {(rating * 100).toFixed(1)}%
      </Text>
    );
  }

  return (
    <Box asChild>
      <Link to={`/borrower/${id}`}>
        <Flex direction={"row"} align={"center"} gap={"3"}>
          {showAvatar && (
            <Avatar
              radius="full"
              color="purple"
              fallback={name.substring(0, 1)}
            />
          )}

          <Flex direction={"column"}>
            <Heading
              as="h6"
              weight={"bold"}
              size={"1"}
              className="capitalize text-purple-600 xl:block dark:text-purple-300"
            >
              {name}
            </Heading>
            {ratingText}
          </Flex>
        </Flex>
      </Link>
    </Box>
  );
}
