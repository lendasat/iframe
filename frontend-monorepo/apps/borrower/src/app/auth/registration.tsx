import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { RegistrationForm } from "@frontend-monorepo/ui-shared";
import init, { begin_registration, load_wallet, new_wallet, persist_new_wallet } from "browser-wallet";
import { md5 } from "hash-wasm";
import { useNavigate } from "react-router-dom";

function Registration() {
  const { register } = useBaseHttpClient();
  const navigate = useNavigate();

  const handleRegister = async (
    name: string,
    email: string,
    password: string,
    inviteCode?: string,
  ) => {
    await init();

    const registrationData = begin_registration(email, password);

    const network = import.meta.env.VITE_BITCOIN_NETWORK;
    const walletDetails = new_wallet(password, network);

    await register(name, email, registrationData.verifier, registrationData.salt, {
      mnemonic_ciphertext: walletDetails.mnemonic_ciphertext,
      network: network,
      xpub: walletDetails.xpub,
    }, inviteCode);

    const key = await md5(email);
    persist_new_wallet(walletDetails.mnemonic_ciphertext, walletDetails.network, walletDetails.xpub, key);
    load_wallet(password, key);

    navigate("/verifyemail");
  };

  return <RegistrationForm handleRegister={handleRegister} />;
}

export default Registration;
