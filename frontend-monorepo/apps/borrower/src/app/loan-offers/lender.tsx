import { Avatar, AvatarFallback } from "@frontend/shadcn";
import { Link } from "react-router-dom";

interface LenderProps {
  id?: string;
  name?: string;
  successful_contracts?: number;
  failed_contracts?: number;
  rating?: number;
  showAvatar?: boolean;
  ratingTextAlign?: "left" | "right";
}

export function Lender({
  name,
  id,
  rating,
  successful_contracts,
  failed_contracts,
  showAvatar,
  ratingTextAlign = "left",
}: LenderProps) {
  const alignmentClass =
    ratingTextAlign === "right" ? "self-end" : "self-start";

  let ratingText = (
    <span
      className={`text-muted-foreground text-sm font-light ${alignmentClass}`}
    >
      No rating yet
    </span>
  );
  if (
    successful_contracts &&
    failed_contracts &&
    rating &&
    successful_contracts + failed_contracts > 0
  ) {
    ratingText = (
      <span
        className={`text-muted-foreground text-sm font-light ${alignmentClass}`}
      >
        {(rating * 100).toFixed(1)}%
      </span>
    );
  }

  return (
    <Link to={`/lender/${id}`} className="block">
      <div className="flex items-center gap-3">
        {showAvatar && (
          <Avatar>
            <AvatarFallback>{name?.substring(0, 1) || ""}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex flex-col">
          <span className="text-foreground text-sm font-bold capitalize xl:block">
            {name}
          </span>
          {ratingText}
        </div>
      </div>
    </Link>
  );
}
