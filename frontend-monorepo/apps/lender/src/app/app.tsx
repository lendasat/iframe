import type { User } from "@frontend-monorepo/base-http-client";
import { WalletProvider } from "@frontend-monorepo/browser-wallet";
import { AuthIsNotSignedIn, AuthIsSignedIn, AuthProviderLender } from "@frontend-monorepo/http-client-lender";
import { useAuth } from "@frontend-monorepo/http-client-lender";
import { Layout, PriceProvider } from "@frontend-monorepo/ui-shared";
import { BsBank } from "react-icons/bs";
import { Outlet, Route, Routes } from "react-router-dom";
import { SemVer } from "semver";
import ForgotPassword from "./auth/forgot-password";
import Login from "./auth/login";
import Logout from "./auth/logout";
import Registration from "./auth/registration";
import ResetPassword from "./auth/reset-password";
import UpgradeToPake from "./auth/upgrade-to-pake";
import ContractDetailsOverview from "./contracts/contract-details-overview";
import MyContracts from "./contracts/my-contracts";
import CreateLoanOffer from "./create-loan-offer";
import ResolveDispute from "./disputes/dispute";
import MyAccount from "./my-account";
import "../assets/styles.css";
import { FeeProvider } from "@frontend-monorepo/mempool";
import { FiHome } from "react-icons/fi";
import { HiOutlineSupport } from "react-icons/hi";
import { IoCreateOutline, IoWalletOutline } from "react-icons/io5";
import { LuActivity, LuSettings } from "react-icons/lu";
import { TbWorldDollar } from "react-icons/tb";
import ErrorBoundary from "./auth/ErrorBoundary";
import VerifyEmailForm from "./auth/verifyEmailForm";
import BorrowerProfile from "./borrowerProfile";
import Dashboard from "./dashboard/dashboard";
import LenderProfile from "./lenderProfile";
import { LoanOffersOverview } from "./loan-offers/LoanOffersOverview";
import MyLoanOfferDetails from "./my-offers/my-loan-offer-details";
import MyLoanOffersOverview from "./my-offers/my-loan-offers-overview";

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
        label: "Create an offer",
        path: "/create-loan-offer",
        icon: IoCreateOutline,
        target: "_self",
        visible: true,
      },
      {
        label: "All Loan Offers",
        path: "/offers",
        icon: TbWorldDollar,
        target: "_self",
        visible: true,
      },
      {
        label: "My Loan Offers",
        path: "/my-offers",
        icon: BsBank,
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
      <Layout
        user={user}
        menuItems={menuItems}
        backendVersion={version}
        logout={logout}
      >
        <Routes>
          <Route
            element={
              <div>
                <Outlet />
              </div>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="/create-loan-offer" element={<CreateLoanOffer />} />
            <Route path="/my-contracts">
              <Route index element={<MyContracts />} />
              <Route path={":id"} element={<ContractDetailsOverview />} />
            </Route>
            <Route path="/my-offers">
              <Route index element={<MyLoanOffersOverview />} />
              <Route path={":id"} element={<MyLoanOfferDetails />} />
            </Route>
            <Route path="/offers">
              <Route index element={<LoanOffersOverview />} />
            </Route>
            <Route path="/disputes/:id" element={<ResolveDispute />} />
            <Route path="/settings/*" element={<MyAccount />} />
          </Route>
          <Route path="/lender/:id" element={<LenderProfile />} />
          <Route path="/borrower/:id" element={<BorrowerProfile />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/resetpassword/:token/:email" element={<ResetPassword />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Layout>
    </WalletProvider>
  );
}

function App() {
  const baseUrl = import.meta.env.VITE_LENDER_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_LENDER_BASE_URL is undefined!");
  }

  return (
    <PriceProvider url={baseUrl}>
      <FeeProvider mempoolUrl={import.meta.env.VITE_MEMPOOL_REST_URL}>
        <AuthProviderLender baseUrl={baseUrl}>
          <AuthIsSignedIn>
            <MainLayoutComponents />
          </AuthIsSignedIn>
          <AuthIsNotSignedIn>
            <Routes>
              <Route index element={<Login />} />
              <Route path="/registration" element={<Registration />} />
              <Route path="/forgotpassword" element={<ForgotPassword />} />
              <Route path="/resetpassword/:token/:email" element={<ResetPassword />} />
              <Route path="/verifyemail/:token?" element={<VerifyEmailForm />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/login/:status?" element={<Login />} />
              <Route path="/upgrade-to-pake" element={<UpgradeToPake />} />
              <Route path="/error" element={<ErrorBoundary />} />
            </Routes>
          </AuthIsNotSignedIn>
        </AuthProviderLender>
      </FeeProvider>
    </PriceProvider>
  );
}

export default App;
