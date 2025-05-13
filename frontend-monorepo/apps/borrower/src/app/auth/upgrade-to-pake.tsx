import { useAuth, useHttpClientBorrower } from "@frontend/http-client-borrower";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  const { upgradeToPake, finishUpgradeToPake } = useHttpClientBorrower();

  return (
    <UpgradeToPakeGeneric
      login={login}
      is_borrower={true}
      upgradeToPake={upgradeToPake}
      finishUpgradeToPake={finishUpgradeToPake}
    />
  );
}

export default UpgradeToPake;
