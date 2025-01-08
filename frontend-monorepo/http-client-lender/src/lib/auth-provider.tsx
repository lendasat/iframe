import type { LoginResponseOrUpgrade, User, Version } from "@frontend-monorepo/base-http-client";
import { useBaseHttpClient } from "@frontend-monorepo/base-http-client";
import axios from "axios";
import { process_login_response, verify_server } from "browser-wallet";
import type { FC, ReactNode } from "react";
import { useCallback } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SemVer } from "semver";
import { allowedPagesWithoutLogin, HttpClientLenderProvider } from "./http-client-lender";
import { FeatureMapper, LenderFeatureFlags } from "./models";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponseOrUpgrade>;
  logout: () => Promise<void>;
  backendVersion: Version;
  enabledFeatures: LenderFeatureFlags[];
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

export const AuthProviderLender: FC<AuthProviderProps> = ({ children, baseUrl }) => {
  return (
    <HttpClientLenderProvider baseUrl={baseUrl}>
      <LenderAuthProviderInner>
        {children}
      </LenderAuthProviderInner>
    </HttpClientLenderProvider>
  );
};

const LenderAuthProviderInner: FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabledFeatures, setEnabledFeatures] = useState<LenderFeatureFlags[]>([]);
  const [backendVersion, setBackendVersion] = useState<Version>({
    version: new SemVer("0.0.0"),
    commit_hash: "unknown",
  });
  const { me, pakeLoginRequest, pakeVerifyRequest, logout: baseLogout, getVersion, check } = useBaseHttpClient();

  const handle401 = useCallback(() => {
    setUser(null);

    if (allowedPagesWithoutLogin(location.pathname)) {
      console.log(`User can stay ${location.pathname}`);
      return;
    }

    navigate("/login", {
      state: {
        returnUrl: window.location.pathname,
      },
    });
  }, [navigate, location]);

  const checkAuthStatus = useCallback(async () => {
    try {
      await check();
    } catch (error) {
      console.log(`Checking status: failed`);
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 401) {
          handle401();
        } else {
          const message = error.response.data.message;
          console.error(
            `Failed to check login status: http: ${error.response?.status} and response: ${
              JSON.stringify(error.response?.data)
            }`,
          );
          throw new Error(message);
        }
      } else {
        throw new Error(`Failed to check login status: http: ${JSON.stringify(error)}`);
      }
    }
  }, [check, handle401]);

  // Background session check
  useEffect(() => {
    checkAuthStatus();
    const intervalId = setInterval(checkAuthStatus, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [checkAuthStatus]);

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
          console.log(`Unexpected error received`, error);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [me, backendVersion, getVersion]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const pakeLoginResponse = await pakeLoginRequest(email);

      if ("must_upgrade_to_pake" in pakeLoginResponse) {
        return { must_upgrade_to_pake: undefined };
      }

      const verificationData = process_login_response(email, password, pakeLoginResponse.salt, pakeLoginResponse.b_pub);

      const pakeVerifyResponse = await pakeVerifyRequest(
        email,
        verificationData.a_pub,
        verificationData.client_proof,
      );

      if (!verify_server(pakeVerifyResponse.server_proof)) {
        throw new Error("failed to verify server proof");
      }

      const enabledFeatures = FeatureMapper.mapEnabledFeatures(pakeVerifyResponse.enabled_features);

      if (enabledFeatures) {
        setEnabledFeatures(enabledFeatures);
      } else {
        setEnabledFeatures([]);
      }

      const currentUser = await me();

      if (currentUser) {
        setUser(currentUser.user);
      } else {
        setUser(null);
      }
      if (!backendVersion) {
        const version = await getVersion();
        setBackendVersion(version);
      }
      return pakeVerifyResponse;
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
