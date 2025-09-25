import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";
import { ReactNode, useEffect } from "react";

interface PostHogProviderProps {
  children: ReactNode;
  appType: "borrower" | "lender";
}

// Initialize PostHog
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "phc_3MrZhmMPhgvjtBN54e9aDhV2iVAom8t3ocDizQxofyw";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let posthogInitialized = false;

export function PostHogProvider({ children, appType }: PostHogProviderProps) {
  useEffect(() => {
    // Only initialize once
    if (!posthogInitialized && typeof window !== "undefined") {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        // Enable session recording with security measures
        session_recording: {
          enabled: true,
          recordCrossOriginIframes: false,
          // SECURITY: Mask all inputs by default to protect sensitive data
          maskAllInputs: true,
          maskTextContent: false,
          // Additional selectors for masking sensitive content
          maskTextSelector: '[data-private], [data-sensitive], .mnemonic, .seed-phrase, .private-key, .secret',
          // Mask network request URLs that might contain sensitive data
          maskNetworkRequestFn: (url: string) => {
            // Mask URLs that might contain sensitive information
            if (url.includes('private') || url.includes('secret') || url.includes('mnemonic')) {
              return null; // Don't record this request at all
            }
            return url;
          },
        },
        autocapture: {
          dom_event_allowlist: ["click", "submit"],
          css_selector_allowlist: [
            "[data-track]",
            "a",
            "button",
            ".button",
            "[role='button']",
          ],
        },
        loaded: (posthog) => {
          // Set app type as a property for all events
          posthog.register({
            app_type: appType,
            environment: import.meta.env.MODE,
          });
        },
      });
      posthogInitialized = true;
    }
  }, [appType]);

  return (
    <PostHogReactProvider client={posthog}>
      {children}
    </PostHogReactProvider>
  );
}