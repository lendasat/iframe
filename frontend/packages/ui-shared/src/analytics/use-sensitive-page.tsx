import { usePostHog } from "posthog-js/react";
import React, { useEffect } from "react";

export function useSensitivePage(isSensitive: boolean = true) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    if (isSensitive) {
      posthog.opt_out_capturing();
    } else {
      posthog.opt_in_capturing();
    }

    return () => {
      if (isSensitive) {
        posthog.opt_in_capturing();
      }
    };
  }, [posthog, isSensitive]);
}

export function withSensitivePage<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  return function SensitivePageWrapper(props: P) {
    useSensitivePage(true);
    return <Component {...props} />;
  };
}
