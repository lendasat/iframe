import { useBaseHttpClient } from "@lendasat/base-http-client";
import { RegistrationForm } from "@lendasat/ui-shared";
import {
  begin_registration,
  load_wallet,
  new_wallet,
  persist_new_wallet,
} from "browser-wallet";
import { md5 } from "hash-wasm";
import { useNavigate, useLocation } from "react-router-dom";

function Registration() {
  const { register } = useBaseHttpClient();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(useLocation().search);
  const referralCode = queryParams.get("ref");

  const handleRegister = async (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => {
    const registrationData = begin_registration(email, password);

    const network = import.meta.env.VITE_BITCOIN_NETWORK;
    const walletDetails = new_wallet(password, network);

    await register(
      name,
      email,
      registrationData.verifier,
      registrationData.salt,
      {
        mnemonic_ciphertext: walletDetails.mnemonic_ciphertext,
        network: network,
        xpub: walletDetails.xpub,
      },
      referralCode,
    );

    const key = await md5(email);
    persist_new_wallet(
      walletDetails.mnemonic_ciphertext,
      walletDetails.network,
      walletDetails.xpub,
      key,
    );
    load_wallet(password, key);

    navigate("/verifyemail");
  };

  return (
    <RegistrationForm
      handleRegister={handleRegister}
      referralCode={referralCode}
    />
  );
}

export default Registration;
