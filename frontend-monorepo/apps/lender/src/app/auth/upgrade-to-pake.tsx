import { useAuth } from "@frontend/http-client-lender";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  return <UpgradeToPakeGeneric login={login} is_borrower={false} />;
}

export default UpgradeToPake;
