import type { BaseHttpClientContextType } from "@frontend-monorepo/base-http-client";
import { BaseHttpClient, BaseHttpClientContext } from "@frontend-monorepo/base-http-client";
import type { Dispute, LenderProfile } from "@frontend-monorepo/http-client-borrower";
import type { AxiosResponse } from "axios";
import axios from "axios";
import { createContext, useContext } from "react";
import type { Contract, CreateLoanOfferRequest, LoanOffer } from "./models";
import { parseRFC3339Date } from "./utils";

// Interface for the raw data received from the API
interface RawContract extends Omit<Contract, "created_at" | "repaid_at"> {
  created_at: string;
  repaid_at?: string;
}

interface RawDispute extends Omit<Dispute, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

export class HttpClientLender extends BaseHttpClient {
  async postLoanOffer(offer: CreateLoanOfferRequest): Promise<LoanOffer | undefined> {
    try {
      const response: AxiosResponse<LoanOffer> = await this.httpClient.post("/api/offers/create", offer);
      return response.data;
    } catch (error) {
      console.error(
        `Failed to post loan offer: http: ${error.response?.status} and response: ${
          JSON.stringify(error.response?.data)
        }`,
      );
      throw error.response?.data;
    }
  }
  async getContracts(): Promise<Contract[]> {
    try {
      const response: AxiosResponse<RawContract[]> = await this.httpClient.get("/api/contracts");
      return response.data.map(contract => {
        const createdAt = parseRFC3339Date(contract.created_at);
        if (createdAt === undefined) {
          throw new Error("Invalid date");
        }

        let repaidAt: Date | undefined;
        if (contract.repaid_at === undefined) {
          repaidAt = undefined;
        } else {
          const parsed = parseRFC3339Date(contract.repaid_at);
          if (parsed === undefined) {
            throw new Error("Invalid repaid_at date");
          }

          repaidAt = parsed;
        }

        return {
          ...contract,
          created_at: createdAt,
          repaid_at: repaidAt,
        };
      });
    } catch (error) {
      console.error(
        `Failed to fetch contracts: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
    }
  }

  async getContract(id: string): Promise<Contract> {
    try {
      const contractResponse: AxiosResponse<RawContract> = await this.httpClient.get(`/api/contracts/${id}`);
      const contract = contractResponse.data;

      const createdAt = parseRFC3339Date(contract.created_at);
      if (createdAt == null) {
        throw new Error("Invalid date");
      }

      return {
        ...contract,
        created_at: createdAt,
        repaid_at: contract?.repaid_at,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch contract: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch contract ${JSON.stringify(error)}`);
      }
    }
  }

  async approveContract(id: string, xpub: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/contracts/${id}/approve?xpub=${xpub}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to approve contract: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not approve contract ${JSON.stringify(error)}`);
      }
    }
  }

  async rejectContract(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`/api/contracts/${id}/reject`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to reject contract: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not reject contract ${JSON.stringify(error)}`);
      }
    }
  }

  async principalGiven(id: string, txid: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/contracts/${id}/principalgiven?txid=${txid}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to mark contract as principal given: http: ${error.response?.status} and response: ${error.response?.data}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to mark contract as principal given ${JSON.stringify(error)}`);
      }
    }
  }

  async markPrincipalConfirmed(id: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/contracts/${id}/principalconfirmed`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to mark contract as repaid: http: ${error.response?.status} and response: ${error.response?.data}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to mark contract as repaid ${JSON.stringify(error)}`);
      }
    }
  }

  async startDispute(contract_id: string, reason: string, comment: string): Promise<Dispute> {
    try {
      const response: AxiosResponse<Dispute> = await this.httpClient.post(`/api/disputes`, {
        contract_id,
        reason,
        comment,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to create dispute: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not start dispute ${JSON.stringify(error)}`);
      }
    }
  }

  async getDispute(disputeId: string): Promise<Dispute> {
    try {
      const response: AxiosResponse<RawDispute> = await this.httpClient.get(`/api/disputes/${disputeId}`);
      const dispute = response.data;

      const createdAt = parseRFC3339Date(dispute.created_at);
      const updatedAt = parseRFC3339Date(dispute.updated_at);
      if (createdAt == null || updatedAt == null) {
        throw new Error("Invalid date");
      }

      return {
        ...dispute,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch dispute: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch dispute ${JSON.stringify(error)}`);
      }
    }
  }

  async getLenderProfile(id: string): Promise<LenderProfile> {
    try {
      const [response] = await Promise.all([this.httpClient.get(`/api/lenders/${id}`)]);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch lender profile: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch lender ${JSON.stringify(error)}`);
      }
    }
  }

  async getBorrowerProfile(id: string): Promise<LenderProfile> {
    try {
      const [response] = await Promise.all([this.httpClient.get(`/api/borrowers/${id}`)]);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch borrower profile: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch borrower ${JSON.stringify(error)}`);
      }
    }
  }

  async getMyLoanOffers(): Promise<LoanOffer[]> {
    try {
      const response: AxiosResponse<LoanOffer[]> = await this.httpClient.get("/api/offers");
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offers: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offers ${JSON.stringify(error)}`);
      }
    }
  }

  async getMyLoanOffer(id: string): Promise<LoanOffer> {
    try {
      const response: AxiosResponse<LoanOffer> = await this.httpClient.get(`/api/offers/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offer: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offer ${JSON.stringify(error)}`);
      }
    }
  }

  async deleteLoanOffer(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`/api/offers/${id}`);
      return;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offer: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offer ${JSON.stringify(error)}`);
      }
    }
  }
}

type LenderHttpClientContextType = Pick<
  HttpClientLender,
  | "postLoanOffer"
  | "getContracts"
  | "getContract"
  | "approveContract"
  | "rejectContract"
  | "principalGiven"
  | "markPrincipalConfirmed"
  | "startDispute"
  | "getDispute"
  | "getLenderProfile"
  | "getBorrowerProfile"
  | "getMyLoanOffers"
  | "getMyLoanOffer"
  | "deleteLoanOffer"
>;

export const LenderHttpClientContext = createContext<LenderHttpClientContextType | undefined>(undefined);

export const useLenderHttpClient = () => {
  const context = useContext(LenderHttpClientContext);
  if (context === undefined) {
    throw new Error("useBorrowerHttpClient must be used within a BorrowerHttpClientProvider");
  }
  return context;
};

// Create a provider component that will wrap your app
interface HttpClientProviderProps {
  children: React.ReactNode;
  baseUrl: string;
}

export const HttpClientLenderProvider: React.FC<HttpClientProviderProps> = ({ children, baseUrl }) => {
  const httpClient = new HttpClientLender(baseUrl);

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

  const lenderClientFunctions: LenderHttpClientContextType = {
    postLoanOffer: httpClient.postLoanOffer.bind(httpClient),
    getContracts: httpClient.getContracts.bind(httpClient),
    getContract: httpClient.getContract.bind(httpClient),
    approveContract: httpClient.approveContract.bind(httpClient),
    rejectContract: httpClient.rejectContract.bind(httpClient),
    principalGiven: httpClient.principalGiven.bind(httpClient),
    markPrincipalConfirmed: httpClient.markPrincipalConfirmed.bind(httpClient),
    startDispute: httpClient.startDispute.bind(httpClient),
    getDispute: httpClient.getDispute.bind(httpClient),
    getLenderProfile: httpClient.getLenderProfile.bind(httpClient),
    getBorrowerProfile: httpClient.getBorrowerProfile.bind(httpClient),
    getMyLoanOffers: httpClient.getMyLoanOffers.bind(httpClient),
    getMyLoanOffer: httpClient.getMyLoanOffer.bind(httpClient),
    deleteLoanOffer: httpClient.deleteLoanOffer.bind(httpClient),
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      <LenderHttpClientContext.Provider value={lenderClientFunctions}>
        {children}
      </LenderHttpClientContext.Provider>
    </BaseHttpClientContext.Provider>
  );
};
