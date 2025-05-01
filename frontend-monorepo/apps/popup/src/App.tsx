import "./App.css";
import Stepper from "@/Stepper.tsx";
import { WalletProvider } from "@frontend/browser-wallet";
import { AuthProvider, useAuth } from "@frontend/http-client-borrower";
import { useSearchParams } from "react-router-dom";
import { PriceProvider } from "./price-context";

function App() {
  const baseUrl = import.meta.env.VITE_BORROWER_BASE_URL;

  return (
    <AuthProvider shouldHandleAuthError={false}>
      <PriceProvider url={baseUrl}>
        <AppInternal></AppInternal>
      </PriceProvider>
    </AuthProvider>
  );
}

function AppInternal() {
  const [searchParams, _setSearchParams] = useSearchParams();

  const amount = parseFloat(searchParams.get("amount") as string) || 1000;
  const lenderId = searchParams.get("lender_id") || "";
  const inviteCode = searchParams.get("code") || "";

  // Send information to the Lendasat button window about the contract being funded.
  //
  // Does not close the popup.
  const onPrincipalGiven = (contractId: string) => {
    window.opener.postMessage(
      {
        status: "success",
        contractId: contractId,
      },
      "*",
    );
  };

  // Instruct the Lendasat button window that we are done with this popup.
  const onDone = (contractId: string) => {
    window.opener.postMessage(
      {
        status: "done",
        contractId: contractId,
      },
      "*",
    );
  };

  const { login, user } = useAuth();

  return (
    <WalletProvider email={user ? user.email : ""}>
      <div className="flex flex-col gap-5">
        <Stepper
          amount={amount}
          lenderId={lenderId}
          inviteCode={inviteCode}
          login={login}
          onPrincipalGiven={onPrincipalGiven}
          onDone={onDone}
        />
      </div>
    </WalletProvider>
  );
}

export default App;
