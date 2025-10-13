import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface FundContractActionProps {
  contractId: string;
}

export function FundContractAction({ contractId }: FundContractActionProps) {
  const navigate = useNavigate();

  const handleFundContract = () => {
    navigate(`/app/contracts/${contractId}/fund`);
  };

  return (
    <Button onClick={handleFundContract} variant="default" className="w-full">
      Fund Contract
    </Button>
  );
}
