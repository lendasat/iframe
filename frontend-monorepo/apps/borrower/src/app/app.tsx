import {
  faMoneyBillTransfer,
  faMoneyCheckDollar,
  faQuestionCircle,
  faRightFromBracket,
  faUserCircle,
} from "@fortawesome/free-solid-svg-icons";
import {
  AuthIsNotSignedIn,
  AuthIsSignedIn,
  AuthProviderBorrower,
  useAuth,
} from "@frontend-monorepo/http-client-borrower";
import { Layout, PriceProvider } from "@frontend-monorepo/ui-shared";
import { Outlet, Route, Routes } from "react-router-dom";
import { SemVer } from "semver";
import EmailVerification from "./auth/email-verification";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import DashBoard from "./dash-board";
import ErrorBoundary from "./ErrorBoundary";
import MyAccount from "./my-account";
import ContractDetailsOverview from "./my-loans/contract-details-overview";
import MyLoans from "./my-loans/my-loans";
import Profile from "./profile";
import RequestLoan from "./request-loan/request-loan";
import { RequestLoanSummary } from "./request-loan/request-loan-summary";

const menuItems = [
  { label: "Request a Loan", icon: faMoneyBillTransfer, path: "/request-loan" },
  { label: "My loans", icon: faMoneyCheckDollar, path: "/my-contracts" },
  { label: "My account", icon: faUserCircle, path: "/my-account" },
  { label: "Help", icon: faQuestionCircle, path: "https://lendasat.notion.site", target: "_blank" },
  { label: "Logout", icon: faRightFromBracket, path: "/logout" },
];

function MainLayoutComponents() {
  const { backendVersion } = useAuth();
  const version = backendVersion ?? {
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  };

  return (
    <Layout
      menuItems={menuItems}
      theme={"light"}
      backendVersion={version}
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
          <Route path="/request-loan" element={<RequestLoan />} />
          <Route path="/my-contracts">
            <Route index element={<MyLoans />} />
            <Route path={":id"} element={<ContractDetailsOverview />} />
          </Route>
          <Route path="/my-account" element={<MyAccount />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/request-loan/:id" element={<RequestLoanSummary />} />
          <Route path="/error" element={<ErrorBoundary />} />
        </Route>
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProviderBorrower baseUrl={import.meta.env.VITE_BORROWER_BASE_URL || "/"}>
      <AuthIsSignedIn>
        <PriceProvider>
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
            <Route path="/verifyemail/:token" element={<EmailVerification />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/error" element={<ErrorBoundary />} />
            <Route path="*" element={<Login />} />
          </Route>
        </Routes>
      </AuthIsNotSignedIn>
    </AuthProviderBorrower>
  );
}

export default App;
