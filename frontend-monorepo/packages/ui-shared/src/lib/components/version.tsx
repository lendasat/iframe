import { Version } from "@frontend/base-http-client";
import { useWallet, Version as WasmVersion } from "@frontend/browser-wallet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from "@frontend/shadcn";
import { useAsync } from "react-use";
import { useEffect, useState } from "react";

const truncateHash = (hash?: string, visibleChars = 8) => {
  if (!hash || hash.length <= visibleChars) return hash;
  return `${hash.substring(0, visibleChars)}`;
};

interface VersionInfoProps {
  getVersion: () => Promise<Version | undefined>;
}

export const VersionInfo = ({ getVersion }: VersionInfoProps) => {
  const { getVersion: getWasmVersion, isInitialized } = useWallet();

  const [wasmVersion, setWasmVersion] = useState<WasmVersion | undefined>(
    undefined,
  );

  const frontendCommitHash = import.meta.env.VITE_APP_GIT_COMMIT_HASH;
  const frontendGitVersion = import.meta.env.VITE_APP_GIT_TAG;

  const {
    loading: backendVersionLoading,
    error: backendVersionError,
    value: backendVersion,
  } = useAsync(async () => {
    return getVersion();
  });

  if (backendVersionError) {
    console.error(backendVersionError);
  }

  useEffect(() => {
    if (!isInitialized) {
      return undefined;
    }
    const version = getWasmVersion();
    try {
      setWasmVersion(version);
    } catch (error) {
      console.error(`Failed fetching wasm version ${error}`);
    }
  }, [isInitialized]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="shadow-md">
        <CardHeader className="px-4 pb-1 pt-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              Build details
            </CardTitle>
            <CardDescription>
              System component versions and build details.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="mt-4 space-y-6">
          {/* WASM Version Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">WASM</h3>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Version:</span>
              {!wasmVersion ? (
                <Skeleton className="h-5 w-14 " />
              ) : (
                <span className="font-mono" title={wasmVersion.version}>
                  {truncateHash(wasmVersion.version)}
                </span>
              )}

              <span className="text-muted-foreground">Build Timestamp:</span>
              {!wasmVersion ? (
                <Skeleton className="h-5 w-14 " />
              ) : (
                <span
                  className="font-mono"
                  title={wasmVersion.build_timestamp.toString()}
                >
                  {wasmVersion.build_timestamp}
                </span>
              )}

              <span className="text-muted-foreground">Commit:</span>

              {!wasmVersion ? (
                <Skeleton className="h-5 w-14 " />
              ) : (
                <span className="font-mono" title={wasmVersion.commit_hash}>
                  {truncateHash(wasmVersion.commit_hash)}
                </span>
              )}
            </div>
          </div>

          {/* Frontend Version Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">Frontend</h3>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-mono">{frontendGitVersion}</span>

              <span className="text-muted-foreground">Commit:</span>
              <span className="font-mono" title={frontendCommitHash}>
                {truncateHash(frontendCommitHash)}
              </span>
            </div>
          </div>

          {/* Backend Version Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center">Backend</h3>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-mono">{backendVersion?.tag}</span>

              <span className="text-muted-foreground">Commit:</span>
              {backendVersionLoading ? (
                <Skeleton className="h-5 w-14 " />
              ) : (
                <span className="font-mono" title={backendVersion?.commit_hash}>
                  {truncateHash(backendVersion?.commit_hash)}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
