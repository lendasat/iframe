import { Flex } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { ReactNode } from "react";
import AbbreviationExplanationInfo from "./abbreviation-explanation-info";

export interface RefundAddressInfoLabelProps {
  children?: ReactNode;
}

export function RefundAddressInfoLabel({
  children,
}: RefundAddressInfoLabelProps) {
  return (
    <AbbreviationExplanationInfo
      header={"Collateral Refund Address"}
      description={`The Bitcoin address where the collateral is sent to after the loan is repaid and the collateral contract is claimed.
This address belongs to the borrower.
`}
    >
      <RadixLink href="https://faq.lendasat.com" target="_blank">
        <Flex gap={"2"}>{children}</Flex>
      </RadixLink>
    </AbbreviationExplanationInfo>
  );
}

export default RefundAddressInfoLabel;
