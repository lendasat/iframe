import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import { mainnet } from "viem/chains";
import { WagmiProvider } from "wagmi";
import App from "./app/app";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Lendasat",
  projectId: "a15c535db177c184c98bdbdc5ff12590",
  chains: [mainnet],
  ssr: true,
});

const queryClient = new QueryClient();

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/*" element={<App />}>
    </Route>,
  ),
);

// TODO: Can we handle these scenarios explicitly, instead of relying on non-null assertions?
//
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Theme>
            <RouterProvider router={router} />
          </Theme>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
