import type { SemVer } from "semver";

export interface User {
  id: number;
  name: string;
  email: string;
  verified: boolean;
  created_at: Date;
}

export interface Version {
  commit_hash: string;
  version: SemVer;
}
