import type { AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";
import { createContext, useContext } from "react";
import type { LoginResponse, MeResponse, Version } from "./models";

export class BaseHttpClient {
  public httpClient: AxiosInstance;

  constructor(baseUrl: string) {
    this.httpClient = axios.create({
      baseURL: baseUrl,
      withCredentials: true,
    });
  }

  async getVersion(): Promise<Version> {
    try {
      const response: AxiosResponse<Version> = await this.httpClient.get("/api/version");
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

  async register(name: string, email: string, password: string, inviteCode?: string): Promise<void> {
    try {
      await this.httpClient.post("/api/auth/register", { name, email, password, invite_code: inviteCode });
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

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const [response] = await Promise.all([this.httpClient.post("/api/auth/login", { email, password })]);
      const data = response.data as LoginResponse;
      console.log(`Login successful`);
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
        throw new Error("Could not send login request");
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
          `Failed logging out: http: ${error.response?.status} and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed logging out: ${JSON.stringify(error)}`);
      }
    }
  }

  async me(): Promise<MeResponse | undefined> {
    try {
      const response: AxiosResponse<MeResponse> = await this.httpClient.get("/api/users/me");
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch me: http: ${error.response?.status} and response: ${JSON.stringify(error.response?.data)}`,
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
      return await this.httpClient.get('/api/auth/check');
  }

  async forgotPassword(email: string): Promise<string> {
    try {
      const response = await this.httpClient.post("/api/auth/forgotpassword", { email: email });
      return response.data.message;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to call forget password: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to call forget password: http: ${JSON.stringify(error)}`);
      }
    }
  }

  async verifyEmail(token: string): Promise<string> {
    try {
      const response = await this.httpClient.get(`/api/auth/verifyemail/${token}`);
      return response.data.message;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to verify email: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to verify email: http: ${JSON.stringify(error)}`);
      }
    }
  }

  async resetPassword(password: string, passwordConfirm: string, passwordResetToken: string): Promise<string> {
    try {
      const response = await this.httpClient.put(`/api/auth/resetpassword/${passwordResetToken}`, {
        password,
        passwordConfirm,
      });
      return response.data.message;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to reset password: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to reset password: http: ${JSON.stringify(error)}`);
      }
    }
  }
}

// Define types for the contexts
export type BaseHttpClientContextType = Pick<
  BaseHttpClient,
  | "register"
  | "login"
  | "logout"
  | "me"
  | "forgotPassword"
  | "resetPassword"
  | "verifyEmail"
  | "getVersion"
  | "check"
>;

// Create the contexts
export const BaseHttpClientContext = createContext<BaseHttpClientContextType | undefined>(undefined);

export const useBaseHttpClient = () => {
  const context = useContext(BaseHttpClientContext);
  if (context === undefined) {
    throw new Error("useBaseHttpClient must be used within a BaseHttpClientProvider");
  }
  return context;
};

// Create a provider component that will wrap your app
interface HttpClientProviderProps {
  children: React.ReactNode;
  baseUrl: string;
}

export const HttpClientProvider: React.FC<HttpClientProviderProps> = ({ children, baseUrl }) => {
  const httpClient = new BaseHttpClient(baseUrl);

  const baseClientFunctions: BaseHttpClientContextType = {
    register: httpClient.register.bind(httpClient),
    login: httpClient.login.bind(httpClient),
    logout: httpClient.logout.bind(httpClient),
    me: httpClient.me.bind(httpClient),
    forgotPassword: httpClient.forgotPassword.bind(httpClient),
    verifyEmail: httpClient.verifyEmail.bind(httpClient),
    resetPassword: httpClient.resetPassword.bind(httpClient),
    getVersion: httpClient.getVersion.bind(httpClient),
    check: httpClient.check.bind(httpClient),
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      {children}
    </BaseHttpClientContext.Provider>
  );
};
