import type { User, Version } from "@frontend-monorepo/base-http-client";
import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import type { LoanProductOption } from "@frontend-monorepo/base-http-client";
import axios from "axios";
import { FC, ReactNode , createContext, useContext, useEffect, useState } from "react";
import { SemVer } from "semver";
import { HttpClientBorrowerProvider } from './http-client-borrower';
import { FeatureMapper } from "./models";
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  backendVersion: Version;
  enabledFeatures: LoanProductOption[];
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
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [backendVersionFetched, setBackendVersionFetched] = useState(false);
  const [backendVersion, setBackendVersion] = useState<Version>({
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  });
  const [loading, setLoading] = useState(true);
  const [enabledFeatures, setEnabledFeatures] = useState<LoanProductOption[]>([]);
  const { me, login: baseLogin, logout: baseLogout, getVersion, check } = useBaseHttpClient();

  const handle401 = () => {
    setUser(null);
    navigate('/login', {
      state: {
        returnUrl: window.location.pathname
      }
    });
  };

  // Background session check
  useEffect(() => {
    checkAuthStatus();
    const intervalId = setInterval(checkAuthStatus, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await me();
        if (currentUser) {
          setUser(currentUser.user);
          const enabledFeatures = FeatureMapper.mapEnabledFeatures(currentUser.enabled_features);

          setEnabledFeatures(enabledFeatures);
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

  const checkAuthStatus = async () => {
    try {
      console.log(`Checking status if logged in`);
      await check();
    } catch (error) {
      console.log(`Checking status: failed`)
      if (axios.isAxiosError(error) && error.response) {

        if (error.response.status === 401) {
          handle401();
        } else {
          const message = error.response.data.message;
          console.error(
            `Failed to check login status: http: ${error.response?.status} and response: ${
              JSON.stringify(error.response?.data)
            }`
          );
          throw new Error(message);
        }
      } else {
        throw new Error(`Failed to check login status: http: ${JSON.stringify(error)}`);
      }
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const loginResponse = await baseLogin(email, password);
      const enabledFeatures = FeatureMapper.mapEnabledFeatures(loginResponse.enabled_features);

      const currentUser = loginResponse.user;

      if (enabledFeatures) {
        setEnabledFeatures(enabledFeatures);
      } else {
        setEnabledFeatures([]);
      }
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
    <AuthContext.Provider value={{ user, loading, login, logout, backendVersion, enabledFeatures }}>
      {children}
    </AuthContext.Provider>
  );
};
