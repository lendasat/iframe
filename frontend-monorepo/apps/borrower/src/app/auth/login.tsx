import { useAuth } from "@frontend/http-client-borrower";
import { LoginForm } from "@frontend/ui-shared";
import {
  does_wallet_exist,
  is_wallet_equal,
  load_wallet,
  restore_wallet,
} from "browser-wallet";
import { md5 } from "hash-wasm";
import { useNavigate, useParams } from "react-router-dom";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { status } = useParams();

  const handleLogin = async (email: string, password: string) => {
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
          walletBackupData.network,
        );
      } catch (error) {
        alert(
          `We could not restore your wallet from the remote backup. You can log in, but certain actions will not be available. Please reach out to Lendasat support. Error: ${error}.`,
        );
        throw error;
      }
    }

    try {
      load_wallet(password, key);
    } catch (error) {
      alert(
        `We could not load your local wallet. You can log in, but certain actions will not be available. Please reach out to Lendasat support. Error: ${error}.`,
      );
      throw error;
    }

    const is_local_wallet_equal_to_remote_wallet = is_wallet_equal(
      key,
      walletBackupData.mnemonic_ciphertext,
      walletBackupData.network,
    );

    if (!is_local_wallet_equal_to_remote_wallet) {
      alert(
        "Your local encrypted wallet does not match your remote encrypted wallet. Please do not request new loans, and reach out to Lendasat support as this can lead to loss of funds.",
      );
    }
  };

  let defaultUsername = "";
  let defaultPassword = "";
  if (
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest" ||
    import.meta.env.VITE_BITCOIN_NETWORK === "signet"
  ) {
    defaultUsername = import.meta.env.VITE_BORROWER_USERNAME;
  }
  if (
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest" ||
    import.meta.env.VITE_BITCOIN_NETWORK === "signet"
  ) {
    defaultPassword = import.meta.env.VITE_BORROWER_PASSWORD;
  }

  let message = "";
  switch (status) {
    case "verified":
      message = "Email successfully verified. Please log in";
  }

  return (
    // <ShadcnLoginForm.LoginForm
    <LoginForm
      handleLogin={handleLogin}
      registrationLink={"/registration"}
      forgotPasswordLink={"/forgotpassword"}
      waitlistLink={"/waitlist"}
      initialUserEmail={defaultUsername}
      initialUserPassword={defaultPassword}
      infoMessage={message}
    />
  );
}

export default Login;
