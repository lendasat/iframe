import { useAuth } from "@frontend-monorepo/http-client-lender";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import { useLocation, useNavigate } from "react-router-dom";
import init, { does_wallet_exist, restore_wallet } from 'browser-wallet';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    defaultUsername = import.meta.env.VITE_LENDER_USERNAME || "lender@lendasat.com";
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultPassword = import.meta.env.VITE_LENDER_PASSWORD || "password123";
  }

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={defaultUsername}
      initialUserPassword={defaultPassword}
    />
  );
}

export default Login;
