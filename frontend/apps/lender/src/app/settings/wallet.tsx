import { MnemonicComponent, useSensitivePage } from "@frontend/ui-shared";

export function Wallet() {
  // Pause PostHog session recording on this sensitive page
  useSensitivePage(true);

  return <MnemonicComponent />;
}
