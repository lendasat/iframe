import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { RegistrationForm } from "@frontend-monorepo/ui-shared";
import init, { new_wallet } from "browser-wallet";
import { useNavigate } from "react-router-dom";

function Registration() {
  const { register } = useBaseHttpClient();
  const navigate = useNavigate();

  const handleRegister = async (
    name: string,
    email: string,
    password: string,
    contractSecret: string,
    inviteCode?: string,
  ) => {
    await init();
    const network = import.meta.env.VITE_BITCOIN_NETWORK;
    const walletDetails = new_wallet(contractSecret, network, name);

    await register(name, email, password, {
      passphrase_hash: walletDetails.passphrase_hash,
      mnemonic_ciphertext: walletDetails.mnemonic_ciphertext,
      network: network,
      xpub: walletDetails.xpub,
    }, inviteCode);

    navigate("/verifyemail");
  };

  return <RegistrationForm handleRegister={handleRegister} />;
}

export default Registration;
