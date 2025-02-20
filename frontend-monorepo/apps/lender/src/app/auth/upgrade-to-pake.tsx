import { useAuth } from "@lendasat/http-client-lender";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@lendasat/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  return <UpgradeToPakeGeneric login={login} is_borrower={false} />;
}

export default UpgradeToPake;
