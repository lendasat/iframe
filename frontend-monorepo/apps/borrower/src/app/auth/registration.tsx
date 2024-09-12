import { useBaseHttpClient } from "@frontend-monorepo/http-client";
import { RegistrationForm } from "@frontend-monorepo/ui-shared";
import React from "react";
import { useNavigate } from "react-router-dom";

function Registration() {
  const { register } = useBaseHttpClient();
  const navigate = useNavigate();

  const handleRegister = async (name: string, email: string, password: string) => {
    await register(name, email, password);
    navigate("/", { state: { registered: true } }); // Redirect to login after successful registration
  };

  return <RegistrationForm handleRegister={handleRegister} />;
}

export default Registration;
