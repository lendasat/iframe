import { Avatar, Box, Flex, Heading, Text } from "@radix-ui/themes";

const formatDateTime = (timezone: string) => {
  return new Intl.DateTimeFormat(navigator.languages, {
    timeZone: timezone,
    timeStyle: "medium",
  }).format(new Date());
};

interface UserStatsProps {
  id: string;
  name: string;
  successful_contracts: number;
  failed_contracts: number;
  rating: number;
  joined_at: Date;
  timezone?: string;
}

export function UserStats({
  name,
  successful_contracts,
  failed_contracts,
  rating,
  joined_at,
  timezone,
}: UserStatsProps) {
  let ratingText = (
    <Text
      className={"text-font dark:text-font-dark self-end"}
      size={"2"}
      weight={"bold"}
    >
      No rating yet
    </Text>
  );
  if (successful_contracts + failed_contracts > 0) {
    ratingText = (
      <Flex gap={"1"}>
        <Text
          className={"text-font dark:text-font-dark self-end"}
          size={"2"}
          weight={"bold"}
        >
          {(rating * 100).toFixed(1)}% success,
        </Text>
        <Text
          className={"text-font dark:text-font-dark self-end"}
          size={"2"}
          weight={"light"}
        >
          {successful_contracts + failed_contracts} contracts
        </Text>
      </Flex>
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
    <Box className="mt-5 px-4 md:pl-8" pt={"3"}>
      <Box className="space-y-4">
        <Box
          p={"4"}
          className="bg-dashboard/50 dark:bg-dark-700/50 flex-grow rounded-2xl border border-purple-400/20 shadow-sm md:max-h-[800px] dark:border-gray-500/50"
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
                className="text-font dark:text-font-dark capitalize"
                size={"4"}
              >
                {name}
              </Heading>
              {timezone && (
                <Flex gap={"1"}>
                  <Text size={"2"} className="text-font dark:text-font-dark">
                    Local time:
                  </Text>
                  <Text
                    size={"2"}
                    className="text-font/50 dark:text-font-dark/50"
                  >
                    {formatDateTime(timezone)}
                  </Text>
                </Flex>
              )}
              <Flex gap={"1"}>
                <Text size={"2"} className="text-font dark:text-font-dark">
                  Joined:
                </Text>
                <Text
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  {new Date(joined_at).toLocaleDateString("en-CA", options)}
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </Box>

        <Box className="bg-dashboard/50 dark:bg-dark-700/50 flex-grow rounded-2xl border border-purple-400/20 px-5 py-6 shadow-sm md:max-h-[800px] dark:border-gray-500/50">
          <Heading
            as="h4"
            className="text-font dark:text-font-dark font-semibold capitalize"
            size={"3"}
          >
            Stats
          </Heading>
          <Box mt={"4"} className="grid max-w-lg gap-5 md:grid-cols-2">
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark capitalize"
                >
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
                <Text
                  size={"3"}
                  weight={"medium"}
                  className="text-font dark:text-font-dark capitalize"
                >
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
