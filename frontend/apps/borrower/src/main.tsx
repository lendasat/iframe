import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import { mainnet } from "viem/chains";
import { WagmiProvider } from "wagmi";
import App from "./app/app";
import "@rainbow-me/rainbowkit/styles.css";
import { ThemeProvider, PostHogProvider } from "@frontend/ui-shared";

const config = getDefaultConfig({
  appName: "Lendasat",
  projectId: "a15c535db177c184c98bdbdc5ff12590",
  chains: [mainnet],
  ssr: true,
});

const queryClient = new QueryClient();

const router = createBrowserRouter(
  createRoutesFromElements(<Route path="/*" element={<App />}></Route>),
);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <PostHogProvider appType="borrower">
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <Theme>
              <ThemeProvider>
                <RouterProvider router={router} />
              </ThemeProvider>
            </Theme>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PostHogProvider>
  </StrictMode>,
);
