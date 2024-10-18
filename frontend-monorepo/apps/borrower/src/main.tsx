import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "@radix-ui/themes/styles.css";
import { MetaMaskProvider } from "@metamask/sdk-react";
import { Theme } from "@radix-ui/themes";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import App from "./app/app";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/*" element={<App />}>
    </Route>,
  ),
);

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <MetaMaskProvider
      debug={false}
      sdkOptions={{
        dappMetadata: {
          name: "Lendasat",
          url: window.location.href,
        },
      }}
    >
      <Theme>
        <RouterProvider router={router} />
      </Theme>
    </MetaMaskProvider>
  </StrictMode>,
);
