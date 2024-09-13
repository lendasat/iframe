import { useBaseHttpClient, User, Version } from "@frontend-monorepo/base-http-client";
import axios from "axios";
import React, { createContext, useContext, useEffect, useState } from "react";
import { HttpClientLenderProvider } from "./http-client-lender";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  backendVersion?: Version;
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
  children: React.ReactNode;
}

type Props = {
  children?: React.ReactNode;
};

export const AuthIsSignedIn = ({ children }: Props) => {
  const { user } = useContext(AuthContext)!;
  return <>{user !== null ? children : ""}</>;
};

export const AuthIsNotSignedIn = ({ children }: Props) => {
  const { user } = useContext(AuthContext)!;
  return <>{user === null ? children : ""}</>;
};

interface AuthProviderProps {
  baseUrl: string;
  children: React.ReactNode;
}

interface AuthProviderProps {
  children: React.ReactNode;
  baseUrl: string;
}

export const AuthProviderLender: React.FC<AuthProviderProps> = ({ children, baseUrl }) => {
  return (
    <HttpClientLenderProvider baseUrl={baseUrl}>
      <LenderAuthProviderInner>
        {children}
      </LenderAuthProviderInner>
    </HttpClientLenderProvider>
  );
};

const LenderAuthProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendVersion, setBackendVersion] = useState<Version | undefined>(undefined);
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
        if (!backendVersion) {
          const version = await getVersion();
          setBackendVersion(version);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          console.log(error.response);
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
  }, [me]);

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
