import { useLenderHttpClient } from "@frontend/http-client-lender";
import { WaitlistForm } from "@frontend/ui-shared";
import { useNavigate } from "react-router-dom";

function Waitlist() {
  const { joinWaitlist } = useLenderHttpClient();
  const navigate = useNavigate();

  const handleRegister = async (email: string) => {
    await joinWaitlist(email);

    navigate("/waitlist/success");
  };

  return <WaitlistForm handleRegister={handleRegister} />;
}

export default Waitlist;
