import { usePostHog } from "posthog-js/react";
import React, { useEffect } from "react";

/**
 * Hook to disable PostHog session recording on sensitive pages
 * Use this on pages that display mnemonics, private keys, or other sensitive data
 *
 * @param isSensitive - Whether the current page contains sensitive data
 */
export function useSensitivePage(isSensitive: boolean = true) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    if (isSensitive) {
      // Pause session recording when on sensitive page
      posthog.sessionRecording?.pauseRecording();
    } else {
      // Resume session recording when leaving sensitive page
      posthog.sessionRecording?.resumeRecording();
    }

    // Cleanup: resume recording when component unmounts
    return () => {
      if (isSensitive) {
        posthog.sessionRecording?.resumeRecording();
      }
    };
  }, [posthog, isSensitive]);
}

/**
 * Higher-order component to wrap sensitive pages
 * Automatically disables session recording for the wrapped component
 */
export function withSensitivePage<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function SensitivePageWrapper(props: P) {
    useSensitivePage(true);
    return <Component {...props} />;
  };
}