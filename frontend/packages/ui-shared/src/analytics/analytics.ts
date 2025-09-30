import posthog from "posthog-js";
import { usePostHog } from "posthog-js/react";

interface EventProperties {
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * Track a custom event in PostHog
 * @param eventName - Name of the event to track
 * @param properties - Optional properties to send with the event
 */
export function trackEvent(eventName: string, properties?: EventProperties) {
  if (typeof window !== "undefined" && posthog) {
    posthog.capture(eventName, properties);
  }
}

/**
 * Hook to get PostHog instance
 * Use this in React components
 */
export function useAnalytics() {
  return usePostHog();
}
