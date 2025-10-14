import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface RepayLoanActionProps {
  contractId: string;
}

export function RepayLoanAction({ contractId }: RepayLoanActionProps) {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate(`/app/contracts/${contractId}/repay`)}
      className="w-full"
    >
      Repay Loan
    </Button>
  );
}
