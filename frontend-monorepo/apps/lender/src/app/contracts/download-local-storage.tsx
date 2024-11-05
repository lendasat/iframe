import type { Version } from "@frontend-monorepo/base-http-client";

export function downloadLocalStorage(version: Version) {
  const localStorageData = { version, ...localStorage };

  const jsonData = JSON.stringify(localStorageData, null, 2);

  const blob = new Blob([jsonData], { type: "application/json" });

  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);

  link.download = `lendasat-backup-${new Date().toISOString()}.json`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
}
