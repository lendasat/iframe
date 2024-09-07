import {
  faMoneyBillTransfer,
  faMoneyCheckDollar,
  faRightFromBracket,
  faUserCircle,
} from "@fortawesome/free-solid-svg-icons";
import { AuthIsNotSignedIn, AuthIsSignedIn, AuthProvider } from "@frontend-monorepo/http-client";
import { Layout } from "@frontend-monorepo/ui-shared";
import { Outlet, Route, Routes } from "react-router-dom";
import EmailVerification from "./auth/email-verification";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import DashBoard from "./dash-board";
import MyAccount from "./my-account";
import { CollateralizeLoan } from "./my-loans/collateralize-loan";
import MyLoans from "./my-loans/my-loans";
import { RepayLoan } from "./my-loans/repay-loan";
import { PriceProvider } from "./price-context";
import Profile from "./profile";
import RequestLoan from "./request-loan/request-loan";
import { RequestLoanSummary } from "./request-loan/request-loan-summary";

const menuItems = [
  { label: "Request a Loan", icon: faMoneyBillTransfer, path: "/request-loan" },
  { label: "My loans", icon: faMoneyCheckDollar, path: "/my-contracts" },
  { label: "My account", icon: faUserCircle, path: "/my-account" },
  { label: "Logout", icon: faRightFromBracket, path: "/logout" },
];

function App() {
  return (
    <AuthProvider baseUrl={import.meta.env.VITE_BORROWER_BASE_URL || "/"}>
      <AuthIsSignedIn>
        <PriceProvider>
          <Layout
            menuItems={menuItems}
            theme={"light"}
          >
            <Routes>
              <Route
                element={
                  <div>
                    <Outlet />
                  </div>
                }
              >
                <Route index element={<DashBoard />} />
                <Route path="/request-loan" element={<RequestLoan />} />
                <Route path="/my-contracts">
                  <Route index element={<MyLoans />} />
                  <Route path={"repay/:id"} element={<RepayLoan />} />
                  <Route path={"collateralize/:id"} element={<CollateralizeLoan />} />
                </Route>
                <Route path="/my-account" element={<MyAccount />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/profile/:id" element={<Profile />} />
                <Route path="/request-loan/:id" element={<RequestLoanSummary />} />
              </Route>
            </Routes>
          </Layout>
        </PriceProvider>
      </AuthIsSignedIn>
      <AuthIsNotSignedIn>
        <Routes>
          <Route index element={<Login />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/forgotpassword" element={<ForgotPassword />} />
          <Route path="/resetpassword/:token" element={<ResetPassword />} />
          <Route path="/verifyemail/:token" element={<EmailVerification />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </AuthIsNotSignedIn>
    </AuthProvider>
  );
}

export default App;
