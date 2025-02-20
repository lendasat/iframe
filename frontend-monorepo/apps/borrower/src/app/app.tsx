import { WalletProvider } from "@lendasat/browser-wallet";
import {
  AuthIsNotSignedIn,
  AuthIsSignedIn,
  AuthProviderBorrower,
  useAuth,
} from "@lendasat/http-client-borrower";
import { Layout, PriceProvider } from "@lendasat/ui-shared";
import { BsBank } from "react-icons/bs";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import ContractDetailsOverview from "./contracts/contract-details-overview";
import MyContracts from "./contracts/my-contracts";
import DashBoard from "./dashboard/dash-board";
import ResolveDispute from "./disputes/dispute";
import ErrorBoundary from "./ErrorBoundary";
import History from "./History";
import AvailableOffers from "./request-loan/available-offers";
import Settings from "./settings/settings";
import "../assets/styles.css";
import type { User } from "@lendasat/base-http-client";
import { LoanProductOption } from "@lendasat/base-http-client";
import { FeeProvider } from "@lendasat/mempool";
import { FiHome } from "react-icons/fi";
import { GoGitPullRequest } from "react-icons/go";
import { HiOutlineSupport } from "react-icons/hi";
import { IoCardOutline, IoWalletOutline } from "react-icons/io5";
import { LuActivity, LuSettings } from "react-icons/lu";
import UpgradeToPake from "./auth/upgrade-to-pake";
import VerifyEmailForm from "./auth/verifyEmailForm";
import BorrowerProfile from "./borrowerProfile";
import Cards from "./cards/Cards";
import LenderProfile from "./lenderProfile";
import { LoanRequestFlow } from "./loan-requests/loan-request-flow";
import RestrictedAccessPage from "./RestrictedAccessPage";
import { useEffect } from "react";
import init from "browser-wallet";
import browserWalletUrl from "browser-wallet/browser_wallet_bg.wasm?url";

const menuItems = [
  {
    group: [
      {
        label: "home",
        path: "/",
        icon: FiHome,
        target: "_self",
        visible: true,
      },
      {
        label: "activities",
        path: "/history",
        icon: LuActivity,
        target: "_self",
        visible: false,
      },
    ],
    separator: true,
  },
  {
    group: [
      {
        label: "Request Loan",
        path: "/requests",
        icon: GoGitPullRequest,
        target: "_self",
        visible: true,
      },
      {
        label: "Available offers",
        path: "/available-offers",
        icon: BsBank,
        target: "_self",
        visible: true,
      },
      {
        label: "Card",
        path: "/cards",
        icon: IoCardOutline,
        target: "_self",
        visible: true,
      },
      {
        label: "My Contracts",
        path: "/my-contracts",
        icon: IoWalletOutline,
        target: "_self",
        visible: true,
      },
    ],
    separator: true,
  },
  {
    group: [
      {
        label: "settings",
        path: "/settings",
        icon: LuSettings,
        target: "_self",
        visible: true,
      },
      {
        label: "support",
        path: "https://lendasat.notion.site",
        icon: HiOutlineSupport,
        target: "_blank",
        visible: true,
      },
    ],
    separator: false,
  },
];

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

  return (
    <WalletProvider email={user.email}>
      <Layout
        user={user}
        menuItems={menuItems}
        backendVersion={backendVersion}
        logout={logout}
      >
        <Routes>
          <Route
            element={
              <div>
                <Outlet />
              </div>
            }
            errorElement={<ErrorBoundary />}
          >
            <Route index element={<DashBoard />} />
            <Route path="/my-contracts">
              <Route index element={<MyContracts />} />
              <Route path={":id"} element={<ContractDetailsOverview />} />
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
            <Route path="/disputes/:id" element={<ResolveDispute />} />
            <Route path="/restricted" element={<RestrictedAccessPage />} />
            <Route
              path="/resetpassword/:token/:email"
              element={<ResetPassword />}
            />
            <Route path="/error" element={<ErrorBoundary />} />
            <Route path="*" element={<DashBoard />} />
          </Route>
        </Routes>
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
  });

  return (
    <AuthProviderBorrower baseUrl={baseUrl}>
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
            <Route path="/forgotpassword" element={<ForgotPassword />} />
            <Route
              path="/resetpassword/:token/:email"
              element={<ResetPassword />}
            />
            <Route path="/verifyemail/:token?" element={<VerifyEmailForm />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/login/:status?" element={<Login />} />
            <Route path="/upgrade-to-pake" element={<UpgradeToPake />} />
            <Route path="/error" element={<ErrorBoundary />} />
          </Route>
        </Routes>
      </AuthIsNotSignedIn>
    </AuthProviderBorrower>
  );
}

export default App;
