// src/Logout.tsx

import { useAuth } from "@frontend-monorepo/http-client";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const { logout } = useAuth(); // Use your custom logout function
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = async () => {
      logout(); // Call your logout function to clear session, etc.
      navigate("/"); // Redirect to homepage
    };

    handleLogout();
  }, [logout, navigate]);

  return null; // No UI needed for this component
};

export default Logout;
