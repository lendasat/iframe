import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import init, { does_wallet_exist, restore_wallet } from "browser-wallet";
import { useLocation, useNavigate } from "react-router-dom";

type LoginState = {
  registered: boolean;
};
function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { registered } = location.state as LoginState || {};
  const oldPath = location.pathname;

  const handleLogin = async (email: string, password: string) => {
    await init();
    const loginResponse = await login(email, password);
    const walletBackupData = loginResponse.wallet_backup_data;

    if (!does_wallet_exist(loginResponse.user.name)) {
      try {
        restore_wallet(
          loginResponse.user.name,
          walletBackupData.passphrase_hash,
          walletBackupData.mnemonic_ciphertext,
          walletBackupData.xpub,
          walletBackupData.network,
        );
      } catch (error) {
        console.error("Failed restoring wallet data");
      }
    }

    if (oldPath) {
      navigate(oldPath);
    } else {
      navigate("/");
    }
  };

  let defaultUsername = "";
  let defaultPassword = "";
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultUsername = import.meta.env.VITE_BORROWER_USERNAME;
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultPassword = import.meta.env.VITE_BORROWER_PASSWORD;
  }

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={defaultUsername}
      initialUserPassword={defaultPassword}
      infoMessage={registered ? "We have sent an verification email to your email address" : undefined}
    />
  );
}

export default Login;
