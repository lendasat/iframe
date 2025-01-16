import { useAuth } from "@frontend-monorepo/http-client-lender";
import { LoginForm } from "@frontend-monorepo/ui-shared";
import init, { does_wallet_exist, restore_wallet } from "browser-wallet";
import { md5 } from "hash-wasm";
import { useLocation, useNavigate, useParams } from "react-router-dom";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const oldPath = location.pathname;
  const { status } = useParams();

  const handleLogin = async (email: string, password: string) => {
    await init();

    const loginResponse = await login(email, password);

    if ("must_upgrade_to_pake" in loginResponse) {
      navigate("/upgrade-to-pake");
      return;
    }

    const walletBackupData = loginResponse.wallet_backup_data;

    const key = await md5(email);
    if (!does_wallet_exist(key)) {
      try {
        restore_wallet(
          key,
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
    defaultUsername = import.meta.env.VITE_LENDER_USERNAME || "";
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest" || import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultPassword = import.meta.env.VITE_LENDER_PASSWORD || "";
  }

  let message = "";
  switch (status) {
    case "verified":
      message = "Email successfully verified. Please log in";
  }

  return (
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      initialUserEmail={defaultUsername}
      initialUserPassword={defaultPassword}
      infoMessage={message}
    />
  );
}

export default Login;
