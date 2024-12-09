import { WalletProvider } from "@frontend-monorepo/browser-wallet";
import {
  AuthIsNotSignedIn,
  AuthIsSignedIn,
  AuthProviderBorrower,
  useAuth,
} from "@frontend-monorepo/http-client-borrower";
import { Layout, PriceProvider } from "@frontend-monorepo/ui-shared";
import { BsBank } from "react-icons/bs";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import DashBoard from "./dashboard/dash-board";
import ResolveDispute from "./disputes/dispute";
import ErrorBoundary from "./ErrorBoundary";
import History from "./History";
import MyAccount from "./my-account";
import ContractDetailsOverview from "./my-loans/contract-details-overview";
import MyLoans from "./my-loans/my-loans";
import Profile from "./profile";
import RequestLoan from "./request-loan/request-loan";
import { RequestLoanSummary } from "./request-loan/request-loan-summary";
import "../assets/styles.css";
import type { User } from "@frontend-monorepo/base-http-client";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { FiHome } from "react-icons/fi";
import { GoGitPullRequest } from "react-icons/go";
import { HiOutlineSupport } from "react-icons/hi";
import { IoCardOutline, IoWalletOutline } from "react-icons/io5";
import { LuActivity, LuSettings } from "react-icons/lu";
import VerifyEmailForm from "./auth/verifyEmailForm";
import Cards from "./cards/Cards";
import CustomRequest from "./request-loan/custom-loan-request";
import RequestLoanWizard from "./request-loan/request-loan-wizard";
import RestrictedAccessPage from "./RestrictedAccessPage";

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
        path: "/request-loan",
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
        path: "/setting",
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

const FeatureFlagProtectedRoute = ({ children, neededFeature }: ProtectedRouteProps) => {
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
    <WalletProvider
      email={user.email}
    >
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
              <Route index element={<MyLoans />} />
              <Route path={":id"} element={<ContractDetailsOverview />} />
            </Route>
            <Route path="/requests/*" element={<RequestLoanWizard />} />

            <Route
              path="/cards"
              element={
                <FeatureFlagProtectedRoute neededFeature={LoanProductOption.PayWithMoonDebitCard}>
                  <Cards />
                </FeatureFlagProtectedRoute>
              }
            />
            <Route path="/custom-request" element={<CustomRequest />} />
            <Route path="/history" element={<History />} />
            <Route path="/setting" element={<MyAccount />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/request-loan" element={<RequestLoan />} />
            <Route path="/request-loan/:id" element={<RequestLoanSummary />} />
            <Route path="/disputes/:id" element={<ResolveDispute />} />
            <Route path="/restricted" element={<RestrictedAccessPage />} />
            <Route path="/resetpassword/:token" element={<ResetPassword />} />
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

  return (
    <AuthProviderBorrower baseUrl={baseUrl}>
      <AuthIsSignedIn>
        <PriceProvider url={baseUrl}>
          <MainLayoutComponents />
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
            <Route path="/resetpassword/:token" element={<ResetPassword />} />
            <Route path="/verifyemail/:token?" element={<VerifyEmailForm />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/login/:status?" element={<Login />} />
            <Route path="/error" element={<ErrorBoundary />} />
          </Route>
        </Routes>
      </AuthIsNotSignedIn>
    </AuthProviderBorrower>
  );
}

export default App;
