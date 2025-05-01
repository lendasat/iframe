import { Contract } from "@frontend/http-client-borrower";
import { get_nostr_derivation_path } from "browser-wallet";

export function downloadContractBackup(contract: Contract) {
  const derivationPathNsec = get_nostr_derivation_path();

  const data = {
    ...localStorage,
    contract,
    derivationPathNsec,
  };

  const jsonData = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonData], { type: "application/json" });

  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);

  link.download = `lendasat-popup-backup-${new Date().toISOString()}.json`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
}
