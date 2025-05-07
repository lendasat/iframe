import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { VersionInfo } from "@frontend/ui-shared";

export function VersionPage() {
  let { getVersion } = useHttpClientBorrower();

  return <VersionInfo getVersion={getVersion} />;
}
