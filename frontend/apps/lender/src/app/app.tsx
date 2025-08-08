import { User, WebSocketNotification } from "@frontend/http-client-lender";
import { WalletProvider } from "@frontend/browser-wallet";
import {
  AuthIsNotSignedIn,
  AuthIsSignedIn,
  AuthProvider,
} from "@frontend/http-client-lender";
import { useAuth } from "@frontend/http-client-lender";
import { changeProtocolToWSS, PriceProvider } from "@frontend/ui-shared";
import { Outlet, Route, Routes } from "react-router-dom";
import { SemVer } from "semver";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import Waitlist from "./waitlist/waitlist";
import WaitlistSuccess from "./waitlist/success";
import ResetPassword from "./auth/reset-password";
import UpgradeToPake from "./auth/upgrade-to-pake";
import BitcoinCollateralizedLoan from "./contracts/bitcoin-loan-component";
import MyContracts from "./contracts_old/my-contracts";
import CreateLoanOfferPage from "./loan-offers/CreateLoanOfferPage";
import Settings from "./settings/settings";
import "../assets/styles.css";
import { FeeProvider } from "@frontend/mempool";
import ErrorBoundary from "./auth/ErrorBoundary";
import VerifyEmailForm from "./auth/verifyEmailForm";
import BorrowerProfile from "./borrowerProfile";
import Dashboard from "./dashboard/dashboard";
import LenderProfile from "./lenderProfile";
import { LoanOffersOverview } from "./loan-offers/LoanOffersOverview";
import MyLoanOfferDetails from "./my-offers/my-loan-offer-details";
import MyLoanOffersOverview from "./my-offers/my-loan-offers-overview";
import init from "browser-wallet";
import browserWalletUrl from "browser-wallet/browser_wallet_bg.wasm?url";
import { useEffect } from "react";
import AvailableLoanApplications from "./loan-applications/available-loan-applications";
import TakeLoanApplication from "./loan-applications/loan-applications";
import { Layout } from "./layout";
import { Toaster } from "sonner";
import "@frontend/ui-shared";
import { CreateLoanOfferForm } from "./loan-offers/CreateLoanOfferForm";

function MainLayoutComponents() {
  const { backendVersion, user: lenderUser, logout } = useAuth();
  const version = backendVersion ?? {
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  };

  // Mapping function to normalize user objects
  const mapLenderUser = (lenderUser: User) => ({
    id: lenderUser.id,
    name: lenderUser.name,
    email: lenderUser.email,
    createdAt: lenderUser.created_at,
    verified: lenderUser.verified,
  });

  // TODO: It's annoying to have to deal with a possibly null or incomplete `User` here. Can we
  // handle these scenarios explicitly, instead of relying on non-null assertions?
  //
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = mapLenderUser(lenderUser!);

  return (
    <WalletProvider email={user.email}>
      <Layout user={user} backendVersion={version} logout={logout}>
        <Routes>
          <Route
            element={
              <div>
                <Outlet />
              </div>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="/create-loan-offer"
              element={<CreateLoanOfferPage />}
            />
            <Route path="/my-contracts">
              <Route index element={<MyContracts />} />
              <Route path={":id"} element={<BitcoinCollateralizedLoan />} />
            </Route>
            <Route path="/my-offers">
              <Route index element={<MyLoanOffersOverview />} />
              <Route path={":id"} element={<MyLoanOfferDetails />} />
            </Route>
            <Route path="/offers">
              <Route index element={<LoanOffersOverview />} />
            </Route>
            <Route path="/settings/*" element={<Settings />} />
          </Route>
          <Route
            path="/loan-applications"
            element={<AvailableLoanApplications />}
          />
          <Route
            path="/loan-applications/:id"
            element={<TakeLoanApplication />}
          />
          <Route path="/lender/:id" element={<LenderProfile />} />
          <Route path="/borrower/:id" element={<BorrowerProfile />} />
          <Route path="/logout" element={<Logout />} />
          <Route
            path="/resetpassword/:token/:email"
            element={<ResetPassword />}
          />
          <Route
            path="/test-loan-offer-form"
            element={<CreateLoanOfferForm />}
          />
          <Route path="*" element={<Dashboard />} />
        </Routes>
        <Toaster />
      </Layout>
    </WalletProvider>
  );
}

function App() {
  const baseUrl = import.meta.env.VITE_LENDER_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_LENDER_BASE_URL is undefined!");
  }

  useEffect(() => {
    (async () => {
      await init(browserWalletUrl);
    })();
  });

  return (
    <PriceProvider url={baseUrl}>
      <FeeProvider mempoolUrl={import.meta.env.VITE_MEMPOOL_REST_URL}>
        <AuthProvider shouldHandleAuthError={true}>
          <AuthIsSignedIn>
            <WebSocketNotification
              url={`${changeProtocolToWSS(import.meta.env.VITE_LENDER_BASE_URL)}/api/notifications/ws`}
              debug={true}
              onConnect={() => console.log("🔗 Notifications connected")}
              onDisconnect={() => console.log("❌ Notifications disconnected")}
              onError={(error) =>
                console.error("🚨 Notification error:", error)
              }
            >
              <MainLayoutComponents />
            </WebSocketNotification>
          </AuthIsSignedIn>
          <AuthIsNotSignedIn>
            <Routes>
              <Route index element={<Login />} />
              <Route path="/registration" element={<Registration />} />
              <Route path="/waitlist">
                <Route index element={<Waitlist />} />
                <Route path={"success"} element={<WaitlistSuccess />} />
              </Route>
              <Route path="/forgotpassword" element={<ForgotPassword />} />
              <Route
                path="/resetpassword/:token/:email"
                element={<ResetPassword />}
              />
              <Route
                path="/verifyemail/:token?"
                element={<VerifyEmailForm />}
              />
              <Route path="/logout" element={<Logout />} />
              <Route path="/login/:status?" element={<Login />} />
              <Route path="/upgrade-to-pake" element={<UpgradeToPake />} />
              <Route path="/error" element={<ErrorBoundary />} />
            </Routes>
          </AuthIsNotSignedIn>
        </AuthProvider>
      </FeeProvider>
    </PriceProvider>
  );
}

export default App;
