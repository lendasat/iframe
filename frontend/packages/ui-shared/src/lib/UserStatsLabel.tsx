import {
  Avatar,
  AvatarFallback,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@frontend/shadcn";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";

interface UserProps {
  id?: string;
  name?: string;
  successful_contracts: number;
  showAvatar?: boolean;
  showStats?: boolean;
  ratingTextAlign?: "left" | "right";
  vetted?: boolean; // Only for lenders
}

interface UserStatsProps extends UserProps {
  isBorrower: boolean;
}

function UserStatsLabel({
  name,
  id,
  successful_contracts,
  showAvatar,
  showStats = true,
  ratingTextAlign = "left",
  isBorrower,
  vetted = false,
}: UserStatsProps) {
  const alignmentClass =
    ratingTextAlign === "right" ? "self-end" : "self-start";

  let ratingText = (
    <span
      className={`text-muted-foreground text-sm font-light ${alignmentClass}`}
    >
      No rating yet
    </span>
  );
  if (successful_contracts > 0) {
    ratingText = (
      <span
        className={`text-muted-foreground text-sm font-light ${alignmentClass}`}
      >
        {successful_contracts} Contracts
      </span>
    );
  }

  let baseUrl = "lender";
  if (isBorrower) {
    baseUrl = "borrower";
  }

  return (
    <Link to={`/${baseUrl}/${id}`} className="block">
      <div className="flex items-center gap-3">
        {showAvatar && (
          <Avatar>
            <AvatarFallback>{name?.substring(0, 1) || ""}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-bold capitalize xl:block">
              {name}
            </span>
            {!isBorrower && vetted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Star className="h-4 w-4" color={"orange"} fill={"yellow"} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Vetted by Lendasat</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {showStats && ratingText}
        </div>
      </div>
    </Link>
  );
}

export function LenderStatsLabel({
  name,
  id,
  successful_contracts,
  showAvatar,
  showStats,
  ratingTextAlign = "left",
  vetted = false,
}: UserProps) {
  return (
    <UserStatsLabel
      isBorrower={false}
      successful_contracts={successful_contracts}
      showAvatar={showAvatar}
      ratingTextAlign={ratingTextAlign}
      showStats={showStats}
      name={name}
      id={id}
      vetted={vetted}
    />
  );
}

export function BorrowerStatsLabel({
  name,
  id,
  successful_contracts,
  showAvatar,
  showStats,
  ratingTextAlign = "left",
}: UserProps) {
  return (
    <UserStatsLabel
      isBorrower={true}
      successful_contracts={successful_contracts}
      showAvatar={showAvatar}
      showStats={showStats}
      ratingTextAlign={ratingTextAlign}
      name={name}
      id={id}
    />
  );
}
