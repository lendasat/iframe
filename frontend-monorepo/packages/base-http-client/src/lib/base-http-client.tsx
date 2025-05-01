import type { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";
import { createContext, useContext } from "react";
import type {
  IsRegisteredResponse,
  MeResponse,
  PakeLoginResponse,
  PakeLoginResponseOrUpgrade,
  PakeVerifyResponse,
  UpgradeToPakeResponse,
  Version,
  WalletBackupData,
} from "./models";

export class BaseHttpClient {
  public httpClient: AxiosInstance;

  constructor(baseUrl: string, onAuthError?: () => void) {
    this.httpClient = axios.create({
      baseURL: baseUrl,
      withCredentials: true,
    });
    // Add response interceptor for handling 401s
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Call the auth error handler if provided
          onAuthError?.();
        }
        return Promise.reject(error);
      },
    );
  }

  async getVersion(): Promise<Version> {
    try {
      const response: AxiosResponse<Version> =
        await this.httpClient.get("/api/version");
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const message = error.response.data.message;

        throw new Error(message);
      } else {
        throw new Error(`Could not fetch version ${JSON.stringify(error)}`);
      }
    }
  }

  async getIsRegistered(email: string): Promise<IsRegisteredResponse> {
    try {
      const response: AxiosResponse<IsRegisteredResponse> =
        await this.httpClient.get(`/api/auth/is-registered?email=${email}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const message = error.response.data.message;

        throw new Error(message);
      } else {
        throw error;
      }
    }
  }

  async register(
    name: string,
    email: string,
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    inviteCode?: string,
  ): Promise<void> {
    try {
      await this.httpClient.post("/api/auth/register", {
        name,
        email,
        verifier,
        salt,
        wallet_backup_data: walletBackupData,
        invite_code: inviteCode,
      });
      console.log("Registration successful");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const message = error.response.data.message;

        throw new Error(message);
      } else {
        throw error;
      }
    }
  }

  async pakeLoginRequest(email: string): Promise<PakeLoginResponseOrUpgrade> {
    try {
      const [response] = await Promise.all([
        this.httpClient.post("/api/auth/pake-login", { email }),
      ]);
      const data = response.data as PakeLoginResponse;
      console.log(`Got PAKE login response`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const status = error.response.status;
        const message = error.response.data.message;

        if (status === 400) {
          console.log(message);
          if (message === "upgrade-to-pake") {
            return { must_upgrade_to_pake: undefined };
          }

          throw new Error("Please check your credentials and try again.");
        } else {
          throw new Error(message);
        }
      } else {
        throw new Error("Could not send PAKE login request");
      }
    }
  }

  async pakeVerifyRequest(
    email: string,
    aPub: string,
    clientProof: string,
  ): Promise<PakeVerifyResponse> {
    try {
      const [response] = await Promise.all([
        this.httpClient.post("/api/auth/pake-verify", {
          email,
          a_pub: aPub,
          client_proof: clientProof,
        }),
      ]);
      const data = response.data as PakeVerifyResponse;
      console.log(`Got PAKE verification response`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const status = error.response.status;
        const message = error.response.data.message;

        if (status === 400) {
          throw new Error("Please check your credentials and try again.");
        } else {
          throw new Error(message);
        }
      } else {
        throw new Error("Could not send PAKE verify request");
      }
    }
  }

  async upgradeToPake(
    email: string,
    oldPassword: string,
  ): Promise<UpgradeToPakeResponse> {
    try {
      const [response] = await Promise.all([
        this.httpClient.post("/api/auth/upgrade-to-pake", {
          email,
          old_password: oldPassword,
        }),
      ]);
      const data = response.data as UpgradeToPakeResponse;
      console.log(`Got upgrade-to-PAKE response`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const status = error.response.status;
        const message = error.response.data.message;

        if (status === 400) {
          console.log(message);

          throw new Error("Please check your credentials and try again.");
        } else {
          throw new Error(message);
        }
      } else {
        throw new Error("Could not upgrade-to-PAKE request");
      }
    }
  }

  async finishUpgradeToPake(
    email: string,
    oldPassword: string,
    verifier: string,
    salt: string,
    newWalletBackupData: WalletBackupData,
  ): Promise<void> {
    try {
      await Promise.all([
        this.httpClient.post("/api/auth/finish-upgrade-to-pake", {
          email,
          old_password: oldPassword,
          verifier,
          salt,
          new_wallet_backup_data: newWalletBackupData,
        }),
      ]);
      console.log(`Ugraded to PAKE`);
      return;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const status = error.response.status;
        const message = error.response.data.message;

        if (status === 400) {
          console.log(message);

          throw new Error("Please check your credentials and try again.");
        } else {
          throw new Error(message);
        }
      } else {
        throw new Error("Could not upgrade-to-PAKE request");
      }
    }
  }

  async logout(): Promise<void> {
    try {
      await this.httpClient.get("/api/auth/logout");
      console.log("Logout successful");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed logging out: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed logging out: ${JSON.stringify(error)}`);
      }
    }
  }

  async me(): Promise<MeResponse | undefined> {
    try {
      const response: AxiosResponse<MeResponse> =
        await this.httpClient.get("/api/users/me");
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch me: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to fetch me: ${JSON.stringify(error)}`);
      }
    }
  }

  // A convenience function to check if the user is still logged in.
  // Throws an exception if the user was not or if another error occurred
  async check(): Promise<void> {
    return await this.httpClient.get("/api/auth/check");
  }

  async forgotPassword(email: string): Promise<string> {
    try {
      const response = await this.httpClient.post("/api/auth/forgotpassword", {
        email: email,
      });
      return response.data.message;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to call forget password: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to call forget password: http: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async verifyEmail(token: string): Promise<string> {
    try {
      const response = await this.httpClient.get(
        `/api/auth/verifyemail/${token}`,
      );
      return response.data.message;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to verify email: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to verify email: http: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async resetPassword(
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    passwordResetToken: string,
  ): Promise<string> {
    try {
      const response = await this.httpClient.put(
        `/api/auth/resetpassword/${passwordResetToken}`,
        {
          verifier,
          salt,
          new_wallet_backup_data: walletBackupData,
        },
      );
      return response.data.message;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to reset password: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to reset password: http: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async joinWaitlist(email: string): Promise<void> {
    try {
      await this.httpClient.post("/api/auth/waitlist", {
        email,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const message = error.response.data.message;

        throw new Error(message);
      } else {
        throw new Error(
          `Failed to register for waiting list: ${JSON.stringify(error)}`,
        );
      }
    }
  }
}

// Define types for the contexts
export type BaseHttpClientContextType = Pick<
  BaseHttpClient,
  | "register"
  | "getIsRegistered"
  | "pakeLoginRequest"
  | "pakeVerifyRequest"
  | "upgradeToPake"
  | "finishUpgradeToPake"
  | "logout"
  | "me"
  | "forgotPassword"
  | "resetPassword"
  | "verifyEmail"
  | "getVersion"
  | "check"
  | "joinWaitlist"
>;

// Create the contexts
export const BaseHttpClientContext = createContext<
  BaseHttpClientContextType | undefined
>(undefined);

export const useBaseHttpClient = () => {
  const context = useContext(BaseHttpClientContext);
  if (context === undefined) {
    throw new Error(
      "useBaseHttpClient must be used within a BaseHttpClientProvider",
    );
  }
  return context;
};

// Create a provider component that will wrap your app
interface HttpClientProviderProps {
  children: React.ReactNode;
  baseUrl: string;
}

export const HttpClientProvider: React.FC<HttpClientProviderProps> = ({
  children,
  baseUrl,
}) => {
  const httpClient = new BaseHttpClient(baseUrl);

  const baseClientFunctions: BaseHttpClientContextType = {
    register: httpClient.register.bind(httpClient),
    getIsRegistered: httpClient.getIsRegistered.bind(httpClient),
    pakeLoginRequest: httpClient.pakeLoginRequest.bind(httpClient),
    pakeVerifyRequest: httpClient.pakeVerifyRequest.bind(httpClient),
    upgradeToPake: httpClient.upgradeToPake.bind(httpClient),
    finishUpgradeToPake: httpClient.finishUpgradeToPake.bind(httpClient),
    logout: httpClient.logout.bind(httpClient),
    me: httpClient.me.bind(httpClient),
    forgotPassword: httpClient.forgotPassword.bind(httpClient),
    verifyEmail: httpClient.verifyEmail.bind(httpClient),
    resetPassword: httpClient.resetPassword.bind(httpClient),
    getVersion: httpClient.getVersion.bind(httpClient),
    check: httpClient.check.bind(httpClient),
    joinWaitlist: httpClient.joinWaitlist.bind(httpClient),
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      {children}
    </BaseHttpClientContext.Provider>
  );
};
