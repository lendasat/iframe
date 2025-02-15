import { Flex } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { ReactNode } from "react";
import AbbreviationExplanationInfo from "./abbreviation-explanation-info";

export interface LtvInfoLabelProps {
  children?: ReactNode;
}

export function LtvInfoLabel({ children }: LtvInfoLabelProps) {
  return (
    <AbbreviationExplanationInfo
      header={"Loan-To-Value"}
      subHeader={"LTV"}
      description={
        "The Loan-To-Value (LTV) ratio is the relationship between the loan amount and the value of the collateral provided. The starting LTV (for example, 50%) indicates how much Bitcoin must be placed into the collateral contract to back a certain loan amount."
      }
    >
      <RadixLink href="https://faq.lendasat.com" target="_blank">
        <Flex gap={"2"} align={"center"}>
          {children}
        </Flex>
      </RadixLink>
    </AbbreviationExplanationInfo>
  );
}

export default LtvInfoLabel;
