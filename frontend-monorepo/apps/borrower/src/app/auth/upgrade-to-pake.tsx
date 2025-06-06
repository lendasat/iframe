import { useAuth, useHttpClientBorrower } from "@frontend/http-client-borrower";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  const { upgradeToPake, finishUpgradeToPake } = useHttpClientBorrower();

  return (
    <UpgradeToPakeGeneric
      login={async (email, password) => {
        let response = await login(email, password);
        if ("must_upgrade_to_pake" in response) {
          return {
            mustUpgrade: true,
          };
        } else {
          return {
            mustUpgrade: false,
          };
        }
      }}
      is_borrower={true}
      upgradeToPake={upgradeToPake}
      finishUpgradeToPake={finishUpgradeToPake}
    />
  );
}

export default UpgradeToPake;
