import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface WithdrawCollateralActionProps {
  contractId: string;
}

export function WithdrawCollateralAction({
  contractId,
}: WithdrawCollateralActionProps) {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate(`/app/contracts/${contractId}/withdraw`)}
      className="w-full"
    >
      Withdraw Collateral
    </Button>
  );
}
