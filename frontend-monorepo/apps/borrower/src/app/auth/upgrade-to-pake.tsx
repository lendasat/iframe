import { useAuth } from "@frontend/http-client-borrower";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  return <UpgradeToPakeGeneric login={login} is_borrower={true} />;
}

export default UpgradeToPake;
