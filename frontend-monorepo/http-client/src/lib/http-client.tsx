// src/HttpClient.tsx

import axios, { AxiosInstance, AxiosResponse } from "axios";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextProps {
  httpClient: AxiosInstance;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  me: () => Promise<User | undefined>;
  contract: (id: string) => Promise<Contract | undefined>;
  user: User | null;
}

interface AuthProviderProps {
  baseUrl: string;
  children: React.ReactNode;
}

export class User {
  id: number;
  name: string;
  email: string;
  verified: boolean;
  created_at: Date;
}

export enum ContractStatus {
  REQUESTED = "REQUESTED",
  OPEN = "OPEN",
  CLOSING = "CLOSING",
  CLOSED = "CLOSED",
}

export interface LenderProfile {
  name: string;
  rate: number;
  loans: number;
}

export interface Contract {
  id: string;
  amount: number;
  opened: Date;
  repaid: Date;
  expiry: Date;
  interest: number;
  collateral: number;
  status: ContractStatus;
  lender: LenderProfile;
  originatorFee: number;
  refundAddress: string;
  repaymentAddress: string;
  collateralAddress: string;
  loanAddress: string;
}

type Props = {
  children?: React.ReactNode;
};

export const AuthIsSignedIn = ({ children }: Props) => {
  const { user } = useContext(AuthContext);
  return <>{user !== null ? children : null}</>;
};

export const AuthIsNotSignedIn = ({ children }: Props) => {
  const { user } = useContext(AuthContext);
  return <>{user === null ? children : null}</>;
};

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ baseUrl, children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    me().then((user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    }).catch((err) => {
      console.error("Failed");
    });
  }, [setUser]);

  // Create an Axios instance with the provided base URL
  const httpClient = axios.create({
    baseURL: baseUrl,
    withCredentials: true, // Important to handle cookies
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
  });

  const register = async (name: string, email: string, password: string) => {
    try {
      await httpClient.post("/api/auth/register", { name, email, password });
      console.log("Registration successful");
    } catch (error) {
      console.error("Registration failed", error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await httpClient.post("/api/auth/login", { email: email, password: password });
      await me();
      console.log(`Login successful`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const status = error.response.status;
        const message = error.response.message;

        if (status === 400) {
          // TODO: we should handle if a user is not verified differently
          throw new Error("Please check your credentials and try again.");
        } else {
          throw new Error(message);
        }
      } else {
        throw new Error("Could not send login request");
      }
    }
  };

  const logout = async () => {
    try {
      const response = await httpClient.get("/api/auth/logout");
      const data = response.data;
      console.log(data);
      console.log("Logout successful");
    } catch (error) {
      if (error.response.status === 401) {
        // user wasn't logged in
      } else {
        console.error(`Failed logging out: http: ${error.response.status} and response: ${error.response.data}`);
      }
    }
    setUser(null);
  };

  const me = async (): Promise<User | undefined> => {
    try {
      const response: AxiosResponse<User> = await httpClient.get("/api/users/me");
      const user = response.data;
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
      return user;
    } catch (error) {
      if (error.response.status === 401) {
        setUser(null);
      } else {
        console.error(`Failed to fetch me: http: ${error.response?.status} and response: ${error.response?.data}`);
      }
      return undefined;
    }
  };

  const contract = async (id: string): Promise<Contract> => {
    return {
      id: "06a98ef2-3f4b-4c78-8fd1-9e8f7329da78",
      amount: 14000,
      opened: new Date(),
      repaid: new Date(),
      expiry: new Date(),
      interest: 11,
      collateral: 0.465,
      status: ContractStatus.OPEN,
      lender: {
        name: "Lord Lendalot 2",
        rate: 99,
        loans: 345,
      },
      originatorFee: 0,
      collateralAddress: "bc1qnrq90k7us7lpnq6xwf76vyuhrsf3wxaz3cmtc2",
      refundAddress: "bc1qnrq90k7us7lpnq6xwf76vyuhrsf3wxaz3cmtc2",
      repaymentAddress: "0x12314014910249012940129410240124",
      loanAddress: "0x124124j12j4oh12o4h12h4og12o4p1h24oih124",
    };
  };

  return (
    <AuthContext.Provider value={{ httpClient, register, login, logout, user, me, contract }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
