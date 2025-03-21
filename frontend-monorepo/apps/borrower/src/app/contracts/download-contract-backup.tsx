import type { Version } from "@frontend/base-http-client";
import { Contract } from "@frontend/http-client-borrower";
import { derive_npub } from "browser-wallet";

export function downloadContractBackup(version: Version, contract: Contract) {
  const counterpartyNpub = derive_npub(contract.lender_xpub);

  const data = { version, ...localStorage, contract, counterpartyNpub };

  const jsonData = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonData], { type: "application/json" });

  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);

  link.download = `lendasat-backup-${new Date().toISOString()}.json`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
}
