import { LoanOffer, LoanOfferStatus } from "@frontend-monorepo/http-client-lender";
import { Badge } from "@radix-ui/themes";
import React from "react";

export interface StatusBadgeProps {
  offer: LoanOffer;
}

export function StatusBadge({ offer }: StatusBadgeProps) {
  let color = "green";
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
    // @ts-ignore
    <Badge variant="soft" size={"2"} color={color} radius="medium">
      {offer.status}
    </Badge>
  );
}
