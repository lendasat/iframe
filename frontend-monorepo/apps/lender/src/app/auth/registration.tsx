import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import { RegistrationForm } from "@frontend-monorepo/ui-shared";
import { useNavigate } from "react-router-dom";

function Registration() {
  const { register } = useBaseHttpClient();
  const navigate = useNavigate();

  const handleRegister = async (name: string, email: string, password: string, inviteCode?: string) => {
    await register(name, email, password, inviteCode);
    navigate("/", { state: { registered: true } }); // Redirect to login after successful registration
  };

  return <RegistrationForm handleRegister={handleRegister} />;
}

export default Registration;
