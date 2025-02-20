import { useAuth } from "@lendasat/http-client-borrower";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@lendasat/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  return <UpgradeToPakeGeneric login={login} is_borrower={true} />;
}

export default UpgradeToPake;
