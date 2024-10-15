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
import ContractDetailsOverview from "./contracts/contract-details-overview";
import MyContracts from "./contracts/my-contracts";
import CreateLoanOffer from "./create-loan-offer";
import ResolveDispute from "./disputes/dispute";
import "./../styles.css";
import { FiHome } from "react-icons/fi";
import { HiOutlineSupport } from "react-icons/hi";
import { IoCreateOutline, IoWalletOutline } from "react-icons/io5";
import { LuActivity, LuSettings } from "react-icons/lu";
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
      },
      {
        label: "activities",
        path: "/history",
        icon: LuActivity,
        target: "_self",
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
      },
      {
        label: "loan proposal",
        path: "/my-offers",
        icon: BsBank,
        target: "_self",
      },
      {
        label: "My Loans",
        path: "/my-contracts",
        icon: IoWalletOutline,
        target: "_self",
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
      },
      {
        label: "support",
        path: "https://lendasat.notion.site",
        icon: HiOutlineSupport,
        target: "_blank",
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
  const mapLenderUser = (lenderUser: any) => ({
    id: lenderUser?.id,
    name: lenderUser?.name,
    email: lenderUser?.email,
    createdAt: lenderUser?.created_at,
    verified: lenderUser?.verified,
  });

  const user = lenderUser ? mapLenderUser(lenderUser) : null;

  return (
    <Layout
      user={user}
      menuItems={menuItems}
      theme={"light"}
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
