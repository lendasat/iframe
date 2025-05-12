import { useBaseHttpClient } from "@frontend/base-http-client";
import { useAuth } from "@frontend/http-client-lender";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  const { upgradeToPake, finishUpgradeToPake } = useBaseHttpClient();

  return (
    <UpgradeToPakeGeneric
      login={login}
      is_borrower={false}
      upgradeToPake={upgradeToPake}
      finishUpgradeToPake={finishUpgradeToPake}
    />
  );
}

export default UpgradeToPake;
