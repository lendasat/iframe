import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";
import { ReactNode, useEffect } from "react";

interface PostHogProviderProps {
  children: ReactNode;
  appType: "borrower" | "lender";
}

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

if (POSTHOG_KEY && POSTHOG_HOST && typeof window !== "undefined") {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    },
    loaded: () => {
      if (import.meta.env.DEV) {
        console.log("[PostHog] Initialized");
      }
    },
  });
}

export function PostHogProvider({ children, appType }: PostHogProviderProps) {
  useEffect(() => {
    if (POSTHOG_KEY && POSTHOG_HOST) {
      posthog.register({
        app_type: appType,
        environment: import.meta.env.MODE,
      });
    }
  }, [appType]);

  return (
    <PostHogReactProvider client={posthog}>
      {children}
    </PostHogReactProvider>
  );
}