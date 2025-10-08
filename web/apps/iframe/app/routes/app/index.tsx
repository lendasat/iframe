import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function AppIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to contracts by default
    navigate("/app/contracts", { replace: true });
  }, [navigate]);

  return null;
}
