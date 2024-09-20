import { faMoneyBillTransfer, faMoneyCheckDollar, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { AuthIsNotSignedIn, AuthIsSignedIn, AuthProviderLender } from "@frontend-monorepo/http-client-lender";
import { useAuth } from "@frontend-monorepo/http-client-lender";
import { Layout, PriceProvider } from "@frontend-monorepo/ui-shared";
import { Outlet, Route, Routes } from "react-router-dom";
import { SemVer } from "semver";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import ContractDetailsOverview from "./contracts/contract-details-overview";
import MyContracts from "./contracts/my-contracts";
import CreateLoanOffer from "./create-loan-offer";
import ResolveDispute from "./disputes/dispute";

const menuItems = [
  { label: "Create Loan Offer", icon: faMoneyBillTransfer, path: "/create-loan-offer" },
  { label: "My Loans", icon: faMoneyCheckDollar, path: "/my-contracts" },
  { label: "Logout", icon: faRightFromBracket, path: "/logout" },
];

function MainLayoutComponents() {
  const { backendVersion } = useAuth();
  const version = backendVersion ?? {
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  };
  return (
    <Layout menuItems={menuItems} theme={"light"} backendVersion={version}>
      <Routes>
        <Route
          element={
            <div>
              <Outlet />
            </div>
          }
        >
          <Route path="/create-loan-offer" element={<CreateLoanOffer />} />
          <Route path="/my-contracts">
            <Route index element={<MyContracts />} />
            <Route path={":id"} element={<ContractDetailsOverview />} />
          </Route>
          <Route path="/disputes/:id" element={<ResolveDispute />} />
        </Route>
        <Route path="/logout" element={<Logout />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <PriceProvider>
      <AuthProviderLender baseUrl={import.meta.env.VITE_LENDER_BASE_URL || "/"}>
        <AuthIsSignedIn>
          <MainLayoutComponents />
        </AuthIsSignedIn>
        <AuthIsNotSignedIn>
          <Routes>
            <Route index element={<Login />} />
            <Route path="/registration" element={<Registration />} />
            <Route path="/forgotpassword" element={<ForgotPassword />} />
            <Route path="/resetpassword/:token" element={<ResetPassword />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </AuthIsNotSignedIn>
      </AuthProviderLender>
    </PriceProvider>
  );
}

export default App;
