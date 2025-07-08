import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const changeProtocolToWSS = (urlString: string): string => {
  try {
    const url = new URL(urlString);
    if (url.protocol === "https:") {
      url.protocol = "wss:";
    } else if (url.protocol === "http:") {
      url.protocol = "ws:";
    }
    return url.toString();
  } catch (e) {
    const error = e instanceof Error ? e.message : e;

    const errorString =
      error === "" ? "Invalid URL." : `Invalid URL: ${error}.`;

    throw new Error(errorString);
  }
};
