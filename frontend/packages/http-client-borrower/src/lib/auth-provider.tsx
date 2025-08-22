import { createHttpClient, HttpClientContext } from "./http-client-borrower";
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { FC, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SemVer } from "semver";
import {
  FeatureMapper,
  User,
  Version,
  LoanProductOption,
  LoginResponseOrUpgrade,
} from "./models";
import { process_login_response, verify_server } from "browser-wallet";
import { isAllowedPageWithoutLogin } from "./utils";
import { i18n } from "@frontend/ui-shared";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponseOrUpgrade>;
  totpLogin: (
    sessionToken: string,
    totpCode: string,
  ) => Promise<LoginResponseOrUpgrade>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  backendVersion: Version;
  enabledFeatures: LoanProductOption[];
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
  const baseUrl = import.meta.env.VITE_BORROWER_BASE_URL;

  if (!baseUrl) {
    throw new Error("VITE_BORROWER_BASE_URL is undefined!");
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

    return createHttpClient(
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
  const [enabledFeatures, setEnabledFeatures] = useState<LoanProductOption[]>(
    [],
  );

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const userData = await httpClient.me();
        if (userData) {
          setUser(userData.user);
          setEnabledFeatures(
            FeatureMapper.mapEnabledFeatures(userData.enabled_features),
          );
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
        // We refresh the token regularly, as long as the user is on the website. Ideally we would
        // track user actions, i.e. if they were inactive for a long time, we still log out. But
        // it's good enough for now.
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

      // Check if TOTP is required
      if (pakeVerifyResponse.totp_required) {
        // Return session token for TOTP verification step
        return {
          totp_required: true,
          session_token: pakeVerifyResponse.session_token!,
        };
      }

      // Complete login flow if no TOTP required
      const enabledFeatures = FeatureMapper.mapEnabledFeatures(
        pakeVerifyResponse.enabled_features!,
      );

      const currentUser = pakeVerifyResponse.user!;

      if (enabledFeatures) {
        setEnabledFeatures(enabledFeatures);
      } else {
        setEnabledFeatures([]);
      }
      if (currentUser) {
        await i18n.changeLanguage(currentUser.locale);
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

  // Same as above, only that totp token is required
  const totpLogin = async (
    sessionToken: string,
    totpCode: string,
  ): Promise<LoginResponseOrUpgrade> => {
    setLoading(true);
    try {
      const totpVerifyResponse = await httpClient.totpLoginVerify({
        session_token: sessionToken,
        totp_code: totpCode,
      });

      if (!totpVerifyResponse) {
        throw new Error("TOTP verification failed");
      }

      // Complete login flow after successful TOTP verification
      const enabledFeatures = FeatureMapper.mapEnabledFeatures(
        totpVerifyResponse.enabled_features,
      );

      const currentUser = totpVerifyResponse.user;

      if (enabledFeatures) {
        setEnabledFeatures(enabledFeatures);
      } else {
        setEnabledFeatures([]);
      }
      if (currentUser) {
        await i18n.changeLanguage(currentUser.locale);
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
      return totpVerifyResponse;
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

  const refreshUser = async () => {
    try {
      const userData = await httpClient.me();
      if (userData) {
        setUser(userData.user);
        setEnabledFeatures(
          FeatureMapper.mapEnabledFeatures(userData.enabled_features),
        );
      } else {
        setUser(null);
        setEnabledFeatures([]);
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      // Don't throw the error to avoid breaking the UI
      // The user will remain in their current state
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        totpLogin,
        logout,
        refreshUser,
        backendVersion,
        enabledFeatures,
      }}
    >
      <HttpClientContext.Provider value={httpClient}>
        {children}
      </HttpClientContext.Provider>
    </AuthContext.Provider>
  );
};
