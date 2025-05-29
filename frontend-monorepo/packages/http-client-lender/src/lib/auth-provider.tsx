import { FeatureMapper, LoginResponseOrUpgrade, User, Version } from "./models";
import { process_login_response, verify_server } from "browser-wallet";
import { FC, ReactNode, useMemo } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LenderFeatureFlags } from "./models";
import { SemVer } from "semver";
import { isAllowedPageWithoutLogin } from "./utils";
import {
  createHttpClientLender,
  HttpClientLenderContext,
} from "./http-client-lender";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponseOrUpgrade>;
  logout: () => Promise<void>;
  backendVersion: Version;
  enabledFeatures: LenderFeatureFlags[];
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  shouldHandleAuthError: boolean;
}

export const AuthIsSignedIn = ({ children }: { children: ReactNode }) => {
  const context = useContext(AuthContext);
  return context?.user ? children : null;
};

export const AuthIsNotSignedIn = ({ children }: { children: ReactNode }) => {
  const context = useContext(AuthContext);
  return context?.user ? null : children;
};

export const AuthProvider: FC<AuthProviderProps> = ({
  children,
  shouldHandleAuthError = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const baseUrl = import.meta.env.VITE_LENDER_BASE_URL;

  if (!baseUrl) {
    throw new Error("VITE_LENDER_BASE_URL is undefined!");
  }

  // Create the HTTP client with auth error handling
  const httpClient = useMemo(() => {
    const handleAuthError = () => {
      setUser(null); // Clear user state
      navigate("/login", {
        state: { returnUrl: window.location.pathname },
        replace: true,
      });
    };

    return createHttpClientLender(
      baseUrl,
      shouldHandleAuthError ? handleAuthError : undefined,
    );
  }, [navigate, shouldHandleAuthError]);

  const [user, setUser] = useState<User | null>(null);
  const [backendVersion, setBackendVersion] = useState<Version>({
    tag: new SemVer("0.0.0").toString(),
    commit_hash: "unknown",
  });
  const [loading, setLoading] = useState(true);
  const [enabledFeatures, setEnabledFeatures] = useState<LenderFeatureFlags[]>(
    [],
  );

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const userData = await httpClient.me();
        if (userData) {
          setUser(userData.user);
          const featureFlags = FeatureMapper.mapEnabledFeatures(
            userData.enabled_features,
          );
          setEnabledFeatures(featureFlags);
        }

        // Get backend version in the background
        httpClient
          .getVersion()
          .then((version) => {
            if (version) {
              setBackendVersion(version);
            }
          })
          .catch((error) => {
            console.error("Failed to get version:", error);
          });
      } catch (_error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    if (!isAllowedPageWithoutLogin(location.pathname)) {
      initializeAuth();
    }
  }, [httpClient, location.pathname]);

  // Background session check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await httpClient.check();
        // we refresh the token regularly as long as the user is on the website.
        // Ideally we would track uer actions, i.e. if he was inactive for a long time, we still logout,
        // but it's good enough for now.
        await httpClient.refreshToken();
      } catch (e) {
        console.error("Failed checking auth check in auth provider", e);
      }
    };

    if (!isAllowedPageWithoutLogin(location.pathname)) {
      // Initial check
      checkAuth();
      // Set up interval
      const intervalId = setInterval(checkAuth, 5 * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [httpClient, location.pathname]);

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResponseOrUpgrade> => {
    setLoading(true);
    try {
      const pakeLoginResponse = await httpClient.pakeLoginRequest(email);

      if ("must_upgrade_to_pake" in pakeLoginResponse) {
        return { must_upgrade_to_pake: undefined };
      }

      const verificationData = process_login_response(
        email,
        password,
        pakeLoginResponse.salt,
        pakeLoginResponse.b_pub,
      );

      const pakeVerifyResponse = await httpClient.pakeVerifyRequest(
        email,
        verificationData.a_pub,
        verificationData.client_proof,
      );

      if (!pakeVerifyResponse) {
        throw new Error("Verification request failed");
      }

      if (!verify_server(pakeVerifyResponse.server_proof)) {
        throw new Error("failed to verify server proof");
      }

      const currentUser = pakeVerifyResponse.user;

      if (pakeVerifyResponse.enabled_features) {
        const featureFlags = FeatureMapper.mapEnabledFeatures(
          pakeVerifyResponse.enabled_features,
        );
        setEnabledFeatures(featureFlags);
      } else {
        setEnabledFeatures([]);
      }
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      if (!backendVersion) {
        const version = await httpClient.getVersion();
        if (version) {
          setBackendVersion(version);
        }
      }
      return pakeVerifyResponse;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await httpClient.logout();
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    } finally {
      setLoading(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, backendVersion, enabledFeatures }}
    >
      <HttpClientLenderContext.Provider value={httpClient}>
        {children}
      </HttpClientLenderContext.Provider>
    </AuthContext.Provider>
  );
};
