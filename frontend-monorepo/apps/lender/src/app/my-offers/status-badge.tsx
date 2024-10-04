import { LoanOffer, LoanOfferStatus } from "@frontend-monorepo/http-client-lender";
import { Badge } from "@radix-ui/themes";
import { badgePropDefs } from "@radix-ui/themes/dist/cjs/components/badge.props";
import React from "react";

export interface StatusBadgeProps {
  offer: LoanOffer;
}

export function StatusBadge({ offer }: StatusBadgeProps) {
  let color:
    | "gray"
    | "gold"
    | "bronze"
    | "brown"
    | "yellow"
    | "amber"
    | "orange"
    | "tomato"
    | "red"
    | "ruby"
    | "crimson"
    | "pink"
    | "plum"
    | "purple"
    | "violet"
    | "iris"
    | "indigo"
    | "blue"
    | "cyan"
    | "teal"
    | "jade"
    | "green"
    | "grass"
    | "lime"
    | "mint"
    | "sky" = "green";
  switch (offer.status) {
    case LoanOfferStatus.Available:
      color = "green";
      break;
    case LoanOfferStatus.Unavailable:
      color = "gray";
      break;
    case LoanOfferStatus.Deleted:
      color = "red";
      break;
  }

  return (
    <Badge variant="soft" size={"2"} color={color} radius="medium">
      {offer.status}
    </Badge>
  );
}
