// src/HttpClient.tsx

import axios, { AxiosInstance, AxiosResponse } from "axios";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextProps {
  httpClient: AxiosInstance;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  me: () => Promise<User | undefined>;
  getLoanOffers: () => Promise<LoanOffer[] | undefined>;
  postLoanOffer: (offer: LoanOffer) => Promise<LoanOffer | undefined>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (password: string, password_confirm: string, resetPasswordToken: string) => Promise<string>;
  postContractRequest: (request: ContractRequest) => Promise<Contract>;
  getContracts: () => Promise<Contract[]>;
  getContract: (id: string) => Promise<Contract>;
  verifyEmail: (token: string) => Promise<string>;
  getClaimCollateralPsbt: (id: string) => Promise<ClaimCollateralPsbtResponse>;
  postClaimTx: (contract_id: string, tx: string) => Promise<string>;
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
  Requested = "Requested",
  Approved = "Approved",
  CollateralSeen = "CollateralSeen",
  CollateralConfirmed = "CollateralConfirmed",
  PrincipalGiven = "PrincipalGiven",
  Closing = "Closing",
  Closed = "Closed",
  Rejected = "Rejected",
}

export interface LenderProfile {
  name: string;
  rate: number;
  loans: number;
}

export interface ContractRequest {
  loan_id: string;
  initial_ltv: number;
  loan_amount: number;
  initial_collateral_sats: number;
  duration_months: number;
  borrower_btc_address: string;
  borrower_pk: string;
  borrower_loan_address: string;
}

export interface Contract {
  id: string;
  loan_amount: number;
  created_at: Date;
  repaid_at: Date | undefined;
  expiry: Date;
  interest_rate: number;
  collateral_sats: number;
  initial_ltv: number;
  status: ContractStatus;
  lender: LenderProfile;
  borrower_pk: string;
  borrower_btc_address: string;
  loan_repayment_address: string;
  contract_address?: string;
  borrower_loan_address: string;
}

// Interface for the raw data received from the API
interface RawContract extends Omit<Contract, "created_at" | "repaid_at" | "expiry"> {
  created_at: string;
  repaid_at: string;
  expiry: string;
}

export enum LoanAssetType {
  Usdc = "Usdc",
  Usdt = "Usdt",
}

export enum LoanAssetChain {
  Ethereum = "Ethereum",
  Starknet = "Starknet",
}

export interface CreateLoanOfferRequest {
  name: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: LoanAssetType;
  loan_asset_chain: LoanAssetChain;
  loan_repayment_address: string;
}

export interface ClaimCollateralPsbtResponse {
  psbt: string;
  collateral_descriptor: string;
}

export interface LoanOffer {
  id: string;
  lender_id: string;
  min_ltv: number;
  interest_rate: number;
  loan_amount_min: number;
  loan_amount_max: number;
  duration_months_min: number;
  duration_months_max: number;
  loan_asset_type: string;
  loan_asset_chain: string;
}

type Props = {
  children?: React.ReactNode;
};

export const AuthIsSignedIn = ({ children }: Props) => {
  const { user } = useContext(AuthContext);
  return <>{user !== null ? children : ""}</>;
};

export const AuthIsNotSignedIn = ({ children }: Props) => {
  const { user } = useContext(AuthContext);
  return <>{user === null ? children : ""}</>;
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

  const getLoanOffers = async (): Promise<LoanOffer[] | undefined> => {
    try {
      const response: AxiosResponse<LoanOffer[]> = await httpClient.get("/api/offers");
      return response.data;
    } catch (error) {
      console.error(
        `Failed to fetch loan offers: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      return undefined;
    }
  };

  const postLoanOffer = async (offer: LoanOffer): Promise<LoanOffer | undefined> => {
    try {
      const response: AxiosResponse<LoanOffer> = await httpClient.post("/api/offers/create", offer);
      return response.data;
    } catch (error) {
      console.error(
        `Failed to post loan offer: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  };

  const postContractRequest = async (request: ContractRequest): Promise<Contract | undefined> => {
    try {
      const response: AxiosResponse<Contract> = await httpClient.post("/api/contracts", request);
      return response.data;
    } catch (error) {
      console.error(
        `Failed to post contract request: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  };

  const getContracts = async (): Promise<Contract[]> => {
    try {
      const response: AxiosResponse<RawContract[]> = await httpClient.get("/api/contracts");
      return response.data.map(contract => ({
        ...contract,
        created_at: parseRFC3339Date(contract.created_at)!,
        repaid_at: parseRFC3339Date(contract.repaid_at),
        expiry: parseRFC3339Date(contract.expiry)!,
      }));
    } catch (error) {
      console.error(
        `Failed to fetch contracts: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  };

  const getContract = async (id: string): Promise<Contract> => {
    try {
      const contractResponse: AxiosResponse<RawContract> = await httpClient.get(`/api/contracts/${id}`);
      const contract = contractResponse.data;
      return {
        ...contract,
        created_at: parseRFC3339Date(contract.created_at)!,
        repaid_at: parseRFC3339Date(contract.repaid_at),
        expiry: parseRFC3339Date(contract.expiry)!,
      };
    } catch (error) {
      console.error(
        `Failed to fetch contract: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  };

  const getClaimCollateralPsbt = async (id: string): Promise<ClaimCollateralPsbtResponse> => {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> = await httpClient.get(`/api/contracts/${id}/claim`);
      const data = res.data;
      return data;
    } catch (error) {
      console.error(
        `Failed to fetch claim-collateral PSBT: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  };

  const postClaimTx = async (contract_id: string, tx: string): Promise<string> => {
    try {
      const response: AxiosResponse<string> = await httpClient.post(`/api/contracts/${contract_id}`, { tx: tx });
      return response.data;
    } catch (error) {
      console.error(
        `Failed to post claim TX: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  };

  const forgotPassword = async (email: string): Promise<string> => {
    try {
      const response = await httpClient.post("/api/auth/forgotpassword", { email: email });
      return response.data.message;
    } catch (error) {
      const msg = `Failed to reset password: http: ${error.response?.status} and response: ${error.response?.data}`;
      console.error(msg);
      return msg;
    }
  };

  const verifyEmail = async (token: string): Promise<string> => {
    try {
      const response = await httpClient.get(`/api/auth/verifyemail/${token}`);
      return response.data.message;
    } catch (error) {
      const msg = `http: ${error.response?.status} and response: ${error.response?.data.message}`;
      console.error(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (
    password: string,
    passwordConfirm: string,
    passwordResetToken: string,
  ): Promise<string> => {
    try {
      const response = await httpClient.put(`/api/auth/resetpassword/${passwordResetToken}`, {
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
  };

  return (
    <AuthContext.Provider
      value={{
        httpClient,
        register,
        login,
        logout,
        user,
        me,
        getLoanOffers,
        postContractRequest,
        postLoanOffer,
        getContracts,
        forgotPassword,
        resetPassword,
        getContract,
        verifyEmail,
        getClaimCollateralPsbt,
        postClaimTx,
      }}
    >
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

// Helper function to parse RFC3339 dates
const parseRFC3339Date = (dateString: string | undefined): Date | undefined => {
  if (dateString === undefined || dateString === "") {
    return undefined;
  }
  return new Date(dateString);
};
