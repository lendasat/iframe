import { WalletProvider } from "@frontend/browser-wallet";
import {
  AuthIsNotSignedIn,
  AuthIsSignedIn,
  AuthProvider,
  HttpClientProvider,
  useAuth,
} from "@frontend/http-client-borrower";
import { Layout } from "./layout";
import { PriceProvider } from "@frontend/ui-shared";
import { BsBank } from "react-icons/bs";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import ContractDetailsOverview from "./contracts/contract-details-overview";
import MyContracts from "./contracts/my-contracts";
import ResolveDispute from "./disputes/dispute";
import ErrorBoundary from "./ErrorBoundary";
import History from "./History";
import AvailableOffers from "./loan-offers/available-offers";
import Settings from "./settings/settings";
import "../assets/styles.css";
import type { User } from "@frontend/base-http-client";
import { LoanProductOption } from "@frontend/base-http-client";
import { FeeProvider } from "@frontend/mempool";
import UpgradeToPake from "./auth/upgrade-to-pake";
import VerifyEmailForm from "./auth/verifyEmailForm";
import BorrowerProfile from "./borrowerProfile";
import Cards from "./cards/Cards";
import LenderProfile from "./lenderProfile";
import { LoanRequestFlow } from "./loan-offers/loan-request-flow";
import RestrictedAccessPage from "./RestrictedAccessPage";
import { useEffect } from "react";
import init from "browser-wallet";
import browserWalletUrl from "browser-wallet/browser_wallet_bg.wasm?url";
import Waitlist from "./waitlist/waitlist";
import WaitlistSuccess from "./waitlist/success";
import LoanApplication from "./loan-applications/loan-applications";
import AvailableLoanApplications from "./loan-applications/available-loan-applications";
import BitcoinCollateralizedLoan from "./overview/bitcoin-loan-component";
import { Toaster } from "@frontend/shadcn";
import { Dashboard } from "./dash/dash";

interface ProtectedRouteProps {
  children: React.ReactNode;
  neededFeature: LoanProductOption;
}

const FeatureFlagProtectedRoute = ({
  children,
  neededFeature,
}: ProtectedRouteProps) => {
  const { enabledFeatures } = useAuth();
  if (!enabledFeatures) {
    return <Navigate to="/restricted" replace />;
  }

  const hasAccess = enabledFeatures.includes(neededFeature);
  if (!hasAccess) {
    return <Navigate to="/restricted" replace />;
  }

  return <div>{children}</div>;
};

function MainLayoutComponents() {
  const { backendVersion, user: borrowerUser, logout } = useAuth();
  const navigate = useNavigate();

  // Mapping function to normalize user objects
  const mapBorrowerUser = (borrowerUser: User) => ({
    id: borrowerUser.id,
    name: borrowerUser.name,
    email: borrowerUser.email,
    createdAt: borrowerUser.created_at,
    verified: borrowerUser.verified,
  });

  // TODO: It's annoying to have to deal with a possibly null or incomplete `User` here. Can we
  // handle these scenarios explicitly, instead of relying on non-null assertions.
  //
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = mapBorrowerUser(borrowerUser!);

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <WalletProvider email={user.email}>
      <Layout user={user} backendVersion={backendVersion} logout={onLogout}>
        <Routes>
          <Route
            element={
              <div>
                <Outlet />
              </div>
            }
            errorElement={<ErrorBoundary />}
          >
            <Route index element={<Dashboard />} />
            <Route path="/my-contracts">
              <Route index element={<MyContracts />} />
              <Route path={":id"} element={<BitcoinCollateralizedLoan />} />
            </Route>
            <Route path="/requests/*" element={<LoanRequestFlow />} />

            <Route
              path="/cards"
              element={
                <FeatureFlagProtectedRoute
                  neededFeature={LoanProductOption.PayWithMoonDebitCard}
                >
                  <Cards />
                </FeatureFlagProtectedRoute>
              }
            />
            <Route path="/history" element={<History />} />
            <Route path="/settings/*" element={<Settings />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/lender/:id" element={<LenderProfile />} />
            <Route path="/borrower/:id" element={<BorrowerProfile />} />
            <Route path="/available-offers" element={<AvailableOffers />} />
            <Route path="/loan-application" element={<LoanApplication />} />
            <Route
              path="/loan-applications"
              element={<AvailableLoanApplications />}
            />
            <Route path="/disputes/:id" element={<ResolveDispute />} />
            <Route path="/restricted" element={<RestrictedAccessPage />} />
            {/*TODO: remove this later */}
            <Route
              path="/old-details/:id"
              element={<ContractDetailsOverview />}
            />
            <Route
              path="/resetpassword/:token/:email"
              element={<ResetPassword />}
            />
            <Route path="/error" element={<ErrorBoundary />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
        <Toaster />
      </Layout>
    </WalletProvider>
  );
}

function App() {
  const baseUrl = import.meta.env.VITE_BORROWER_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_BORROWER_BASE_URL is undefined!");
  }

  useEffect(() => {
    (async () => {
      await init(browserWalletUrl);
    })();
  }, []);

  return (
    <HttpClientProvider baseUrl={baseUrl}>
      <AuthProvider shouldHandleAuthError={true}>
        <AuthIsSignedIn>
          <PriceProvider url={baseUrl}>
            <FeeProvider mempoolUrl={import.meta.env.VITE_MEMPOOL_REST_URL}>
              <MainLayoutComponents />
            </FeeProvider>
          </PriceProvider>
        </AuthIsSignedIn>
        <AuthIsNotSignedIn>
          <Routes>
            <Route
              element={
                <div>
                  <Outlet />
                </div>
              }
              errorElement={<ErrorBoundary />}
            >
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
            </Route>
          </Routes>
        </AuthIsNotSignedIn>
      </AuthProvider>
    </HttpClientProvider>
  );
}

export default App;
