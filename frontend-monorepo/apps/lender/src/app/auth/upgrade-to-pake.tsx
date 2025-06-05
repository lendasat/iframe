import { useAuth, useLenderHttpClient } from "@frontend/http-client-lender";
import { UpgradeToPake as UpgradeToPakeGeneric } from "@frontend/ui-shared";

function UpgradeToPake() {
  const { login } = useAuth();

  const { upgradeToPake, finishUpgradeToPake } = useLenderHttpClient();

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
      is_borrower={false}
      upgradeToPake={upgradeToPake}
      finishUpgradeToPake={finishUpgradeToPake}
    />
  );
}

export default UpgradeToPake;
