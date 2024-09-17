import axios, { AxiosInstance, AxiosResponse } from "axios";
import { createContext, useContext } from "react";
import { User, Version } from "./models";

export class BaseHttpClient {
  public httpClient: AxiosInstance;
  private user: User | null = null;

  constructor(baseUrl: string) {
    this.httpClient = axios.create({
      baseURL: baseUrl,
      withCredentials: true,
    });
  }

  async getVersion(): Promise<Version> {
    try {
      const response: AxiosResponse<Version> = await this.httpClient.get("/api/version");
      console.log("I did another request");
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
        const status = error.response.status;
        const message = error.response.data.message;

        throw new Error(message);
      } else {
        throw new Error(error);
      }
    }
  }

  async login(email: string, password: string): Promise<void> {
    try {
      await this.httpClient.post("/api/auth/login", { email, password });
      console.log(`Login successful`);
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
      if (error.response.status !== 401) {
        console.error(`Failed logging out: http: ${error.response.status} and response: ${error.response.data}`);
      }
      // If status is 401, user wasn't logged in, so we don't need to throw an error
    }
  }

  async me(): Promise<User | undefined> {
    try {
      const response: AxiosResponse<User> = await this.httpClient.get("/api/users/me");
      const user = response.data;
      if (user) {
        this.user = user;
      } else {
        this.user = null;
      }
      return user;
    } catch (error) {
      if (error.response.status !== 401) {
        console.error(`Failed to fetch me: http: ${error.response?.status} and response: ${error.response?.data}`);
      }
      throw error;
    }
  }

  async forgotPassword(email: string): Promise<string> {
    try {
      const response = await this.httpClient.post("/api/auth/forgotpassword", { email: email });
      return response.data.message;
    } catch (error) {
      const msg = `Failed to reset password: http: ${error.response?.status} and response: ${error.response?.data}`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  async verifyEmail(token: string): Promise<string> {
    try {
      const response = await this.httpClient.get(`/api/auth/verifyemail/${token}`);
      return response.data.message;
    } catch (error) {
      const msg = `http: ${error.response?.status} and response: ${error.response?.data.message}`;
      console.error(msg);
      throw new Error(msg);
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
      const msg =
        `Failed to reset password: http: ${error.response?.status} and response: ${error.response?.data.message}`;
      console.error(msg);
      throw new Error(`HTTP-${error.response?.status}. ${error.response?.data.message}`);
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
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      {children}
    </BaseHttpClientContext.Provider>
  );
};
