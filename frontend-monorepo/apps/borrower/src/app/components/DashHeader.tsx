import { Box, Flex, Heading, Separator } from "@radix-ui/themes";

interface DashInterface {
  label: string;
}

export default function DashHeader(props: DashInterface) {
  return (
    <Box>
      <Box className="px-6 md:px-8" py={"3"}>
        <Flex justify={"between"}>
          <Heading as="h2" weight={"medium"}>
            {props.label}
          </Heading>
        </Flex>
      </Box>
      <Separator size={"4"} />
    </Box>
  );
}
