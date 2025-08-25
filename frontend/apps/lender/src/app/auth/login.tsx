import {
  PakeVerifiedResponse,
  TotpRequired,
  useAuth,
  WalletBackupData,
} from "@frontend/http-client-lender";
import { md5CaseInsensitive } from "@frontend/browser-wallet";
import {
  does_wallet_exist,
  is_wallet_equal,
  load_wallet,
  restore_wallet,
} from "browser-wallet";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ReactComponent as Logo } from "./../../assets/lendasat_svg_logo_long.svg";
import { LoginForm } from "@frontend/shadcn";

function Login() {
  const { login, totpLogin } = useAuth();
  const navigate = useNavigate();
  const { status } = useParams();

  const location = useLocation();
  const returnUrl: string | undefined = location.state?.returnUrl;

  const processSuccessfulLogin = async (
    email: string,
    password: string,
    walletBackupData: WalletBackupData,
  ) => {
    const key = await md5CaseInsensitive(email);
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
        "Your local encrypted wallet does not match your remote encrypted wallet. Please do not approve new loans, and reach out to Lendasat support as this can lead to loss of funds.",
      );
    }

    if (returnUrl) {
      navigate(`${returnUrl}`);
    } else {
      navigate("/");
    }
  };

  const handleLogin = async (
    email: string,
    password: string,
    totpCode?: string,
    sessionToken?: string,
  ) => {
    let loginResponse: TotpRequired | PakeVerifiedResponse;

    if (totpCode && sessionToken) {
      // This is the TOTP verification step
      loginResponse = await totpLogin(sessionToken, totpCode);
    } else {
      // This is the initial login step
      loginResponse = await login(email, password);
    }

    if ("totp_required" in loginResponse) {
      // TOTP is required, the form will handle this
      return loginResponse;
    }

    await processSuccessfulLogin(
      email,
      password,
      loginResponse.wallet_backup_data,
    );
  };

  let defaultUsername = "";
  let defaultPassword = "";
  if (
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest" ||
    import.meta.env.VITE_BITCOIN_NETWORK === "signet"
  ) {
    defaultUsername = import.meta.env.VITE_LENDER_USERNAME || "";
  }
  if (
    import.meta.env.VITE_BITCOIN_NETWORK === "regtest" ||
    import.meta.env.VITE_BITCOIN_NETWORK === "signet"
  ) {
    defaultPassword = import.meta.env.VITE_LENDER_PASSWORD || "";
  }

  let message = "";
  switch (status) {
    case "verified":
      message = "Email successfully verified. Please log in";
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex w-full items-center justify-center">
          <Logo
            height={40}
            width={"auto"}
            className="w-fit invert dark:invert-0"
          />
        </div>
        <LoginForm
          forgotPasswordLink={"/forgotpassword"}
          initialUserEmail={defaultUsername}
          initialUserPassword={defaultPassword}
          registrationLink={"/registration"}
          infoMessage={message}
          handleLogin={handleLogin}
          waitlistLink={"/waitlist"}
          cardDescription={
            <>
              Welcome to lending! If you are a borrower, please go to{" "}
              <a
                href="https://borrow.lendasat.com"
                className={"underline underline-offset-4"}
              >
                https://borrow.lendasat.com
              </a>
            </>
          }
        />
      </div>
    </div>
  );
}

export default Login;
