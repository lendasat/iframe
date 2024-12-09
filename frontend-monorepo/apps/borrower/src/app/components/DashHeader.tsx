import { Box, Flex, Heading } from "@radix-ui/themes";

interface DashInterface {
  label: string;
}

export default function DashHeader(props: DashInterface) {
  return (
    <Box>
      <Box className="px-6 md:px-8" py={"3"}>
        <Flex justify={"between"}>
          <Heading className={"text-font dark:text-font-dark"} as="h2" weight={"medium"}>
            {props.label}
          </Heading>
        </Flex>
      </Box>
    </Box>
  );
}
