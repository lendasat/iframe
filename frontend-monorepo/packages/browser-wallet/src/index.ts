import { md5 } from "hash-wasm";

export const md5CaseInsensitive = (value: string) => {
  return md5(value.toLowerCase());
};

export * from "./lib/browser-wallet";
export * from "./lib/unlock-wallet-modal";
