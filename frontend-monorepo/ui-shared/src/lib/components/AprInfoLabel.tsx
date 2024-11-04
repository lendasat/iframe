import { Flex } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { ReactNode } from "react";
import AbbreviationExplanationInfo from "./abbreviation-explanation-info";

export interface AprInfoLabelProps {
  children?: ReactNode;
}

export function AprInfoLabel({ children }: AprInfoLabelProps) {
  return (
    <AbbreviationExplanationInfo
      header={"Annual Percentage Rate"}
      subHeader={"APR"}
      description={"The APR (Annual Percentage Rate) / Interest Rate is charged on the loan amount that the borrower agrees to pay in addition to the principal by the maturity date. It determines the total interest cost over the loan term."}
    >
      <RadixLink
        href="https://lendasat.notion.site/Frequently-Asked-Questions-100d2f24d4cf800e83bbca7cff3bb707"
        target="_blank"
      >
        <Flex gap={"2"}>
          {children}
        </Flex>
      </RadixLink>
    </AbbreviationExplanationInfo>
  );
}

export default AprInfoLabel;
