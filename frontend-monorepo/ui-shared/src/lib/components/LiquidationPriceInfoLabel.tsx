import { Flex } from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import type { ReactNode } from "react";
import AbbreviationExplanationInfo from "./abbreviation-explanation-info";

export interface LiquidationPriceInfoLabelProps {
  children?: ReactNode;
}

export function LiquidationPriceInfoLabel({ children }: LiquidationPriceInfoLabelProps) {
  return (
    <AbbreviationExplanationInfo
      header={"Liquidation Price"}
      subHeader={""}
      description={"If the price of Bitcoin falls to a predetermined liquidation level, it triggers a liquidation event, and the collateral is liquidated."
        + "Liquidation price equals loan-to-value (LTV) of 95%. If the Bitcoin price hits the liquidation price, even for only a couple of seconds, it is considered as a liquidation event."}
    >
      <RadixLink
        href="https://faq.lendasat.com"
        target="_blank"
      >
        <Flex gap={"2"} align={"center"}>
          {children}
        </Flex>
      </RadixLink>
    </AbbreviationExplanationInfo>
  );
}

export default LiquidationPriceInfoLabel;
