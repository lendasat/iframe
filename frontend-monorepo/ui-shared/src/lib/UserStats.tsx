import { Avatar, Box, Flex, Heading, Text } from "@radix-ui/themes";

interface UserStatsProps {
  id: string;
  name: string;
  successful_contracts: number;
  failed_contracts: number;
  rating: number;
  joined_at: Date;
}

export function UserStats({
  name,
  successful_contracts,
  failed_contracts,
  rating,
  joined_at,
}: UserStatsProps) {
  let ratingText = (
    <Text className={"text-font dark:text-font-dark self-end"} size={"2"} weight={"bold"}>
      No rating yet
    </Text>
  );
  if (successful_contracts + failed_contracts > 0) {
    ratingText = (
      <Text className={"text-font dark:text-font-dark self-end"} size={"2"} weight={"bold"}>
        {(rating * 100).toFixed(1)}%
      </Text>
    );
  }

  // Format date options
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return (
    <Box className="md:pl-8 mt-5 px-4" pt={"3"}>
      <Box className="space-y-4">
        <Box
          p={"4"}
          className="border border-purple-400/20 rounded-2xl dark:border-gray-500/50
        bg-dashboard/50 dark:bg-dark-700/50 shadow-sm flex-grow md:max-h-[800px]
        "
        >
          <Flex align={"center"} gap={"3"}>
            <Avatar
              src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
              size={"7"}
              radius="full"
              color="purple"
              fallback={name.substring(0, 1)}
            />
            <Flex align={"start"} direction={"column"} gap={"1"}>
              <Heading
                as="h4"
                weight={"medium"}
                className="capitalize text-font dark:text-font-dark"
                size={"4"}
              >
                {name}
              </Heading>
              <Flex gap={"1"}>
                <Text size={"2"} className="text-font dark:text-font-dark">
                  Joined:
                </Text>
                <Text size={"2"} className="text-font/50 dark:text-font-dark/50">
                  {new Date(joined_at).toLocaleDateString("en-CA", options)}
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        <Box className="border border-purple-400/20 rounded-2xl px-5 py-6 dark:border-gray-500/50

        bg-dashboard/50 dark:bg-dark-700/50 shadow-sm flex-grow md:max-h-[800px]

        ">
          <Heading
            as="h4"
            className="font-semibold capitalize text-font dark:text-font-dark"
            size={"3"}
          >
            Stats
          </Heading>
          <Box mt={"4"} className="max-w-lg grid md:grid-cols-2 gap-5">
            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Rating
                </Text>
                <Text size={"3"} weight={"medium"} className="capitalize text-font dark:text-font-dark">
                  {ratingText}
                </Text>
              </Flex>
            </Box>

            <Box>
              <Flex direction={"column"} gap={"1"}>
                <Text
                  as="label"
                  weight={"medium"}
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Completed Contracts
                </Text>
                <Text size={"3"} weight={"medium"} className="capitalize text-font dark:text-font-dark">
                  {successful_contracts + failed_contracts}
                </Text>
              </Flex>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default UserStats;
