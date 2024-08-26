import { useAuth } from "@frontend-monorepo/http-client";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = async () => {
      logout();
      navigate("/");
    };

    handleLogout();
  }, [logout, navigate]);

  return null;
};

export default Logout;
