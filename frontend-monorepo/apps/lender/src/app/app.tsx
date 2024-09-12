import { faMoneyBillTransfer, faMoneyCheckDollar, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { AuthIsNotSignedIn, AuthIsSignedIn, AuthProviderLender } from "@frontend-monorepo/http-client";
import { Layout } from "@frontend-monorepo/ui-shared";
import { Outlet, Route, Routes } from "react-router-dom";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import CreateLoanOffer from "./create-loan-offer";
import MyLoans from "./my-loans";

const menuItems = [
  { label: "Create Loan Offer", icon: faMoneyBillTransfer, path: "/create-loan-offer" },
  { label: "My Loans", icon: faMoneyCheckDollar, path: "/my-contracts" },
  { label: "Logout", icon: faRightFromBracket, path: "/logout" },
];

function App() {
  return (
    <AuthProviderLender baseUrl={import.meta.env.VITE_LENDER_BASE_URL || "/"}>
      <AuthIsSignedIn>
        <Layout menuItems={menuItems} theme={"light"}>
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
                <Route index element={<MyLoans />} />
              </Route>
            </Route>
            <Route path="/logout" element={<Logout />} />
          </Routes>
        </Layout>
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
  );
}

export default App;
