import { AuthIsNotSignedIn, AuthIsSignedIn, AuthProviderLender } from "@frontend-monorepo/http-client-lender";
import { useAuth } from "@frontend-monorepo/http-client-lender";
import { Layout, PriceProvider } from "@frontend-monorepo/ui-shared";
import { BsPiggyBank } from "react-icons/bs";
import { GiPayMoney } from "react-icons/gi";
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
import "./../styles.css";
import React from "react";
import { SiBookmyshow } from "react-icons/si";
import MyLoanOfferDetails from "./my-offers/my-loan-offer-details";
import MyLoanOffersOverview from "./my-offers/my-loan-offers-overview";

const menuItems = [
  { label: "Create Loan Offer", icon: GiPayMoney, path: "/create-loan-offer" },
  { label: "My Offers", icon: SiBookmyshow, path: "/my-offers" },
  { label: "My Loans", icon: BsPiggyBank, path: "/my-contracts" },
];

function MainLayoutComponents() {
  const { backendVersion, user: lenderUser } = useAuth();
  const version = backendVersion ?? {
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  };

  // Mapping function to normalize user objects
  const mapLenderUser = (lenderUser: any) => ({
    id: lenderUser?.id,
    name: lenderUser?.name,
    email: lenderUser?.email,
    createdAt: lenderUser?.created_at,
    verified: lenderUser?.verified,
  });

  const user = lenderUser ? mapLenderUser(lenderUser) : null;

  return (
    <Layout user={user} menuItems={menuItems} theme={"light"} backendVersion={version}>
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
          <Route path="/my-offers">
            <Route index element={<MyLoanOffersOverview />} />
            <Route path={":id"} element={<MyLoanOfferDetails />} />
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
    <PriceProvider url={import.meta.env.VITE_LENDER_BASE_URL || "/"}>
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
