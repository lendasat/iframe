import type { LoanOffer } from "@frontend/http-client-lender";
import { LoanOfferStatus } from "@frontend/http-client-lender";
import { Badge } from "@radix-ui/themes";

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

  if (offer.loan_amount_reserve_remaining < offer.loan_amount_min) {
    return (
      <Badge variant="soft" size={"2"} color={"red"} radius="medium">
        {LoanOfferStatus.Unavailable} (depleted)
      </Badge>
    );
  }

  return (
    <Badge variant="soft" size={"2"} color={color} radius="medium">
      {offer.status}
    </Badge>
  );
}
