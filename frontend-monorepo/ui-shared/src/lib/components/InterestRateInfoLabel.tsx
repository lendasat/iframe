import { Flex } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { ReactNode } from "react";
import AbbreviationExplanationInfo from "./abbreviation-explanation-info";

export interface InterestRateInfoLabelProps {
  children?: ReactNode;
}

export function InterestRateInfoLabel({ children }: InterestRateInfoLabelProps) {
  return (
    <AbbreviationExplanationInfo
      header={"Actual Interest Rate"}
      description={`The yearly interest rate is used to calculate the effective interest cost over the loan term.
For example, given a $1000 loan and a yearly interest rate of 12%, the monthly interest rate is 1%.
For a loan duration of 5 months, this amounts to $50 interest. Thus the borrower owes a total of $1050.`}
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

export default InterestRateInfoLabel;
