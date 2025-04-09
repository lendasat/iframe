import { useBaseHttpClient } from "@frontend/base-http-client";
import { OldPasswordOrMnemonic, ResetPasswordForm } from "@frontend/ui-shared";
import {
  begin_registration,
  change_wallet_encryption,
  new_wallet_from_mnemonic,
} from "browser-wallet";
import { md5 } from "hash-wasm";
import { useLocation, useParams } from "react-router-dom";

function ResetPassword() {
  const { resetPassword } = useBaseHttpClient();
  const { token, email } = useParams();

  const queryParams = new URLSearchParams(useLocation().search);
  const cannotUseMnemonic = queryParams.get("nomn") === "true";

  // A user may reset their password as long as they can provide either their old password (to
  // decrypt the encrypted wallet) or the mnemonic (to rebuild the wallet from it).

  const handleSubmit = async (
    newPassword: string,
    oldPasswordOrMnemonic: OldPasswordOrMnemonic,
  ) => {
    console.log("Changing password");

    if (token === undefined) {
      throw new Error("Cannot reset password without token");
    }

    if (email === undefined) {
      throw new Error("Cannot reset password without email");
    }

    console.log(email);

    const registrationData = begin_registration(email, newPassword);

    console.log(
      `Generated registration data for PAKE. Verifier: ${registrationData.verifier}. Salt: ${registrationData.salt}`,
    );

    const network = import.meta.env.VITE_BITCOIN_NETWORK;
    const key = await md5(email);

    // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
    let newWalletDetails;
    if (oldPasswordOrMnemonic.type === "oldPassword") {
      // If the old password is provided, we attempt to decrypt the local encrypted wallet, to then
      // re-encrypt it with the new password.
      //
      // TODO: Allow resetting without a local encrypted wallet i.e. with the remote one instead.

      console.log("Using old password to decrypt encrypted wallet");

      newWalletDetails = change_wallet_encryption(
        key,
        oldPasswordOrMnemonic.value,
        newPassword,
      );
    } else if (oldPasswordOrMnemonic.type === "mnemonic") {
      // If the mnemonic is provided, we generate a new wallet encrypted under the new password.

      console.log("Using mnemonic to create new encrypted wallet");

      newWalletDetails = new_wallet_from_mnemonic(
        newPassword,
        oldPasswordOrMnemonic.value,
        network,
        key,
      );
    } else {
      throw new Error(
        "Cannot reset password without either old password or mnemonic",
      );
    }

    const newWalletBackupData = {
      mnemonic_ciphertext: newWalletDetails.mnemonic_ciphertext,
      network: newWalletDetails.network,
    };

    console.log(
      `Generated new wallet backup data: ${JSON.stringify(newWalletBackupData)}`,
    );

    return await resetPassword(
      registrationData.verifier,
      registrationData.salt,
      newWalletBackupData,
      token,
    );
  };

  return (
    <ResetPasswordForm
      handleSubmit={handleSubmit}
      canUseMnemonic={!cannotUseMnemonic}
      loginUrl={"/login"}
    />
  );
}

export default ResetPassword;
