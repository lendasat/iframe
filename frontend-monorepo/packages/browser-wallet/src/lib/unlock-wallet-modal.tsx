import { ReactNode, useRef, useState } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { useWallet } from "./browser-wallet";
import {
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  DialogTrigger,
  DialogClose,
} from "@frontend/shadcn";
import { LuLoader, LuInfo } from "react-icons/lu";

interface WalletModalProps {
  handleSubmit: () => void;
  children: ReactNode;
  description?: string;
}

export function UnlockWalletModal({
  handleSubmit,
  children,
  description,
}: WalletModalProps) {
  const [password, setPassword] = useState("");
  const [passVisibility, setPassVisibility] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const { loadWallet, isWalletLoaded, doesWalletExist } = useWallet();

  const onOkClick = async () => {
    setLoading(true);
    await delay(100);
    try {
      if (!doesWalletExist) {
        setError("Wallet does not exist");
        return;
      }
      if (!isWalletLoaded) {
        await loadWallet(password);
        console.log("Wallet loaded successfully");
      } else {
        console.log("Wallet already loaded");
        return;
      }
    } catch (error) {
      setError(`Failed to unlock: ${error}`);
      return;
    } finally {
      setLoading(false);
    }

    handleSubmit();
    closeRef.current?.click();
  };

  const defaultDescription =
    "Please provide your password. It is needed to access your encrypted contract data.";

  return (
    <Dialog
      onOpenChange={(_) => {
        setPassword("");
        setError("");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Password</DialogTitle>
          <DialogDescription className="mt-3 flex flex-col gap-3">
            {description ? description : defaultDescription}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onOkClick();
          }}
        >
          <div className="flex w-full items-center space-x-2">
            <Input
              type={passVisibility ? "text" : "password"}
              value={password}
              placeholder="Enter Password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type={"button"}
              variant="outline"
              size="icon"
              onClick={() => setPassVisibility(!passVisibility)}
            >
              {passVisibility ? (
                <LuEyeOff
                  size={24}
                  className="text-font/50 dark:text-font-dark/50"
                />
              ) : (
                <LuEye
                  size={24}
                  className="text-font/50 dark:text-font-dark/50"
                />
              )}
            </Button>
          </div>
          <div className="dark:bg-dark-700 rounded-2 mt-4 bg-white pb-5">
            <div className="flex justify-end space-x-2 pt-4">
              <DialogClose asChild ref={closeRef}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="default"
                className={`w-full`}
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LuLoader className="animate-spin" />
                    Please wait
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
            {error && (
              <Alert variant="destructive" className={"mt-4"}>
                <LuInfo className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
