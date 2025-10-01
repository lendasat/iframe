import { useWallet } from "@frontend/browser-wallet";
import { useEffect, useState } from "react";
import { Keys, loadWasmSync } from "@rust-nostr/nostr-sdk";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/shadcn";
import { useSensitivePage } from "@frontend/ui-shared";
import { useAsync } from "react-use";
import { LuCopy, LuEye, LuEyeOff } from "react-icons/lu";
import { toast } from "sonner";

export function NostrChatSettingsPage() {
  // Pause PostHog session recording on this sensitive page
  useSensitivePage(true);
  const [isNsecVisible, setIsNsecVisible] = useState(false);
  const [nsec, setNsec] = useState<string>("");

  const { getNsec } = useWallet();

  const loadKeysAsync = useAsync(async () => {
    loadWasmSync();
    const nsecHex = await getNsec();

    try {
      const newKeys = Keys.parse(nsecHex);
      return newKeys.secretKey.toBech32();
    } catch (e) {
      console.error(`Error received: ${e}`);
      throw e;
    }
  }, [getNsec]);

  useEffect(() => {
    if (loadKeysAsync.value) {
      setNsec(loadKeysAsync.value);
    }
  }, [loadKeysAsync.value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(nsec);
      toast.success(`Copied Nsec.`);
    } catch (e) {
      console.error(`Failed to copy Nsec: ${e}`);
      toast.error(`Failed to copy Nsec.`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-1 pt-3">
          <div className="flex justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Nsec</CardTitle>
              <CardDescription>
                This key is used to chat with your counterparty privately
                through Nostr.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={async () => setIsNsecVisible(!isNsecVisible)}
            >
              {isNsecVisible ? <LuEyeOff /> : <LuEye />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="mt-4">
          <div className="space-y-4">
            <p className="text-font dark:text-font-dark leading-relaxed">
              Your Nostr secret key (Nsec) can be imported into Nostr clients
              such as Amethyst or YakiHonne. This allows you to communicate with
              your counterparty if Lendasat is down.
            </p>
            <div>
              <code data-private="true" className="private-key nsec">
                {isNsecVisible
                  ? nsec
                  : "*******************************************************************"}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  await handleCopy();
                }}
              >
                <LuCopy />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
