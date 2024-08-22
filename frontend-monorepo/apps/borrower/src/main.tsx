import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";

import { Layout } from "@frontend-monorepo/ui-shared";
import { BrowserRouter } from "react-router-dom";
import App from "./app/app";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
const navItems = [
  { href: "/home", label: "Home" },
  { href: "/loans", label: "Loans" },
  { href: "/logout", label: "Dashboard" },
];

root.render(
  <StrictMode>
    <BrowserRouter>
      <Layout navItems={navItems} description={"Sell at the price you deserve"} title={"Welcome Borrower"}>
        <App />
      </Layout>
    </BrowserRouter>
  </StrictMode>,
);
