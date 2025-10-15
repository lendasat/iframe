import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface RecoverCollateralActionProps {
  contractId: string;
}

export function RecoverCollateralAction({
  contractId,
}: RecoverCollateralActionProps) {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate(`/app/contracts/${contractId}/recover`)}
      className="w-full"
    >
      Recover Collateral
    </Button>
  );
}
