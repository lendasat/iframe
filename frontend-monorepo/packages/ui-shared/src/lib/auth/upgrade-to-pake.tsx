import {
  LoginResponseOrUpgrade,
  useBaseHttpClient,
  WalletBackupData,
} from "@frontend/base-http-client";
import { begin_registration, upgrade_wallet } from "browser-wallet";

import { md5 } from "hash-wasm";
import { useNavigate } from "react-router-dom";
import { UpgradeToPakeForm } from "./upgrade-to-pake-form";

interface UpgradeToPakeProps {
  login: (email: string, password: string) => Promise<LoginResponseOrUpgrade>;
  is_borrower: boolean;
}

export function UpgradeToPake({ login, is_borrower }: UpgradeToPakeProps) {
  const navigate = useNavigate();
  const { upgradeToPake, finishUpgradeToPake } = useBaseHttpClient();

  // What happens if we fail half-way through the upgrade protocol?
  //
  // 1. If authentication fails, the users can keep trying until they use valid authentication.
  //
  // 2. If generating the new wallet data fails, we can try again, although the error is probably
  // not transient and we need to do some debugging for the user.
  //
  // 3. If persisting the new wallet data fails, we should be safe to try again, generating new
  // wallet and overwriting.
  //
  // 4. If generating PAKE registration data fails, we should be safe to start from the beginning.
  //
  // 5. If finishing the PAKE upgrade with the hub fails, we should be safe to start from the
  // beginning.
  //
  // In conclusion, I believe we are always safe to retry from the top.

  const handleFormSubmission = async (
    email: string,
    oldPassword: string,
    contractSecret: string,
    newPassword: string,
  ) => {
    console.log("Upgrading user to PAKE");

    // We begin the upgrade protocol by authenticating with the server using the old password. The
    // server send back the wallet backup data encrypted under the contract secret.
    //
    // We could use the local wallet backup, but the user may be logging in from a new device, so
    // the local wallet backup may not be present.
    const res = await upgradeToPake(email, oldPassword);
    const oldWalletBackupData: WalletBackupData = res.old_wallet_backup_data;
    const contractPks: string[] = res.contract_pks;

    console.log(
      `Hub approves PAKE upgrade and sends old wallet backup: ${JSON.stringify(
        oldWalletBackupData,
      )}`,
    );

    // We continue by:
    //
    // 1. Checking if the old wallet can spend the user's open contracts. If not, we abort because
    // the user will need help.
    //
    // 2. Generating a new wallet based on the original mnemonic (_without_ the contract secret as a
    // passphrase).
    //
    // 3. Producing a new wallet backup encrypted under the `newPassword`.
    const key = await md5(email);
    const newWalletDetails = upgrade_wallet(
      key,
      oldWalletBackupData.mnemonic_ciphertext,
      oldWalletBackupData.network,
      contractSecret,
      newPassword,
      contractPks,
      is_borrower,
    );

    const newWalletBackupData = {
      mnemonic_ciphertext: newWalletDetails.mnemonic_ciphertext,
      network: newWalletDetails.network,
      xpub: newWalletDetails.xpub,
    };

    console.log(
      `Upgraded wallet based on new PAKE password: ${JSON.stringify(
        newWalletBackupData,
      )}`,
    );

    const registrationData = begin_registration(email, newPassword);

    console.log(
      `Generated registration data for PAKE. Verifier: ${registrationData.verifier}. Salt: ${registrationData.salt}`,
    );

    await finishUpgradeToPake(
      email,
      oldPassword,
      registrationData.verifier,
      registrationData.salt,
      newWalletBackupData,
    );

    console.log("PAKE upgrade complete. Logging in now");

    const loginResponse = await login(email, newPassword);

    if ("must_upgrade_to_pake" in loginResponse) {
      throw new Error("Hub still thinks we need to upgrade to PAKE");
      return;
    }

    console.log("Logged in using PAKE for the first time");

    navigate("/");
  };

  return <UpgradeToPakeForm handleFormSubmission={handleFormSubmission} />;
}

export default UpgradeToPake;
