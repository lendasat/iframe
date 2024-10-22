import type { User, Version } from "@frontend-monorepo/base-http-client";
import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import axios from "axios";
import type { FC, ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { SemVer } from "semver";
import { HttpClientBorrowerProvider } from "./http-client-borrower";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  backendVersion: Version;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  baseUrl: string;
  children: ReactNode;
}

type Props = {
  children?: ReactNode;
};

export const AuthIsSignedIn = ({ children }: Props) => {
  const context = useContext(AuthContext);
  return context?.user ? children : "";
};

export const AuthIsNotSignedIn = ({ children }: Props) => {
  const context = useContext(AuthContext);
  return context?.user ? "" : children;
};

interface AuthProviderProps {
  baseUrl: string;
  children: ReactNode;
}

interface AuthProviderProps {
  children: ReactNode;
  baseUrl: string;
}

export const AuthProviderBorrower: FC<AuthProviderProps> = ({ children, baseUrl }) => {
  return (
    <HttpClientBorrowerProvider baseUrl={baseUrl}>
      <BorrowerAuthProviderInner>
        {children}
      </BorrowerAuthProviderInner>
    </HttpClientBorrowerProvider>
  );
};

const BorrowerAuthProviderInner: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [backendVersionFetched, setBackendVersionFetched] = useState(false);
  const [backendVersion, setBackendVersion] = useState<Version>({
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  });
  const [loading, setLoading] = useState(true);
  const { me, login: baseLogin, logout: baseLogout, getVersion } = useBaseHttpClient();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await me();
        if (currentUser) {
          setUser(currentUser);
        } else {
          setUser(null);
        }
        if (!backendVersionFetched) {
          const version = await getVersion();
          setBackendVersion(version);
          setBackendVersionFetched(true);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          const message = error.response.data.message;
          console.error(message);
        } else {
          throw new Error(`Could not check if user is logged in ${JSON.stringify(error)}`);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [me, backendVersionFetched, getVersion]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await baseLogin(email, password);
      const currentUser = await me();
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      if (!backendVersion) {
        const version = await getVersion();
        setBackendVersion(version);
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await baseLogout();
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    } finally {
      setLoading(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, backendVersion }}>
      {children}
    </AuthContext.Provider>
  );
};
