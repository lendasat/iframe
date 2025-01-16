import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend-monorepo/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  return <UpgradeToPakeGeneric login={login} />;
}

export default UpgradeToPake;
