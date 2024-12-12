import { Box, Flex, Heading, HoverCard, Text } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { ReactNode } from "react";
import { FaExternalLinkAlt, FaInfoCircle } from "react-icons/fa";

export interface AbbreviationExplanationInfoProps {
  children?: ReactNode;
  header: string;
  subHeader?: string;
  description?: string;
  learnMore?: string;
}

export function AbbreviationExplanationInfo(
  { children, header, subHeader, description }: AbbreviationExplanationInfoProps,
) {
  return (
    <Text>
      <HoverCard.Root>
        <HoverCard.Trigger>
          {children}
        </HoverCard.Trigger>
        <HoverCard.Content className={"bg-light dark:bg-dark"} maxWidth="40vw">
          <Flex gap="4">
            <Box width="64px" height="64px">
              <FaInfoCircle size={"40px"} className={"text-font dark:text-font-dark"} />
            </Box>
            <Box>
              <Heading className={"text-font dark:text-font-dark"} size="3" as="h3">
                {header}
              </Heading>
              <Text className={"text-font dark:text-font-dark"} as="div" size="2" color="gray" mb="2">
                {subHeader}
              </Text>
              <Text className={"text-font dark:text-font-dark"} as="div" size="2">
                {description}
              </Text>
              <div className="mb-2"></div>

              <RadixLink
                href="https://lendasat.notion.site/Frequently-Asked-Questions-100d2f24d4cf800e83bbca7cff3bb707"
                target="_blank"
              >
                <Flex gap={"2"}>
                  <Text size={"2"} weight={"medium"} className="text-font/70 dark:text-font-dark/70">
                    Learn More
                  </Text>{" "}
                  <FaExternalLinkAlt />
                </Flex>
              </RadixLink>
            </Box>
          </Flex>
        </HoverCard.Content>
      </HoverCard.Root>
      {" "}
    </Text>
  );
}

export default AbbreviationExplanationInfo;
