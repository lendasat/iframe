import { BaseHttpClient, BaseHttpClientContext, BaseHttpClientContextType } from "@frontend-monorepo/base-http-client";
import axios, { AxiosResponse } from "axios";
import { createContext, useContext } from "react";
import { ClaimCollateralPsbtResponse, Contract, ContractRequest, Dispute, LoanOffer } from "./models";
import { parseRFC3339Date } from "./utils";

// Interface for the raw data received from the API
interface RawContract extends Omit<Contract, "created_at" | "repaid_at" | "expiry"> {
  created_at: string;
  repaid_at: string;
  expiry: string;
}
interface RawDispute extends Omit<Dispute, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

export class HttpClientBorrower extends BaseHttpClient {
  async getLoanOffers(): Promise<LoanOffer[] | undefined> {
    try {
      const response: AxiosResponse<LoanOffer[]> = await this.httpClient.get("/api/offers");
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch loan offers: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch version ${JSON.stringify(error)}`);
      }
    }
  }

  async postLoanOffer(offer: LoanOffer): Promise<LoanOffer | undefined> {
    try {
      const response: AxiosResponse<LoanOffer> = await this.httpClient.post("/api/offers/create", offer);
      return response.data;
    } catch (error) {
      console.error(
        `Failed to post loan offer: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error.response?.data;
    }
  }

  async postContractRequest(request: ContractRequest): Promise<Contract | undefined> {
    try {
      const response: AxiosResponse<Contract> = await this.httpClient.post("/api/contracts", request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status == 422) {
          throw new Error(`Invalid request: ${JSON.stringify(error.response.data)}`);
        }

        const message = error.response.data.message;
        console.error(
          `Failed to post contract request: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch version ${JSON.stringify(error)}`);
      }
    }
  }

  async getContracts(): Promise<Contract[]> {
    try {
      const response: AxiosResponse<RawContract[]> = await this.httpClient.get("/api/contracts");
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
  }

  async getContract(id: string): Promise<Contract> {
    try {
      const contractResponse: AxiosResponse<RawContract> = await this.httpClient.get(`/api/contracts/${id}`);
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
  }

  async getClaimCollateralPsbt(id: string): Promise<ClaimCollateralPsbtResponse> {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> = await this.httpClient.get(`/api/contracts/${id}/claim`);
      return res.data;
    } catch (error) {
      console.error(
        `Failed to fetch claim-collateral PSBT: http: ${error.response?.status} and response: ${
          JSON.stringify(error.response?.data)
        }`,
      );
      throw error;
    }
  }
  async getClaimDisputeCollateralPsbt(disputeId: string): Promise<ClaimCollateralPsbtResponse> {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> = await this.httpClient.get(
        `/api/disputes/${disputeId}/claim`,
      );
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const message = error.response.data.message;
        console.error(
          `Failed to fetch claim-dispute-collateral PSBT: http: ${error.response?.status} and response: ${
            JSON.stringify(error.response?.data)
          }`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch claim-dispute-collateral PSBT ${JSON.stringify(error)}`);
      }
    }
  }

  async postClaimTx(contract_id: string, tx: string): Promise<string> {
    try {
      const response: AxiosResponse<string> = await this.httpClient.post(`/api/contracts/${contract_id}`, { tx: tx });
      return response.data;
    } catch (error) {
      console.error(
        `Failed to post claim TX: http: ${error.response?.status} and response: ${error.response?.data}`,
      );
      throw error;
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
      return {
        ...dispute,
        created_at: parseRFC3339Date(dispute.created_at)!,
        updated_at: parseRFC3339Date(dispute.updated_at)!,
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
}

type BorrowerHttpClientContextType = Pick<
  HttpClientBorrower,
  | "getLoanOffers"
  | "postLoanOffer"
  | "postContractRequest"
  | "getContracts"
  | "getContract"
  | "getClaimCollateralPsbt"
  | "getClaimDisputeCollateralPsbt"
  | "postClaimTx"
  | "startDispute"
  | "getDispute"
>;

export const BorrowerHttpClientContext = createContext<BorrowerHttpClientContextType | undefined>(undefined);

export const useBorrowerHttpClient = () => {
  const context = useContext(BorrowerHttpClientContext);
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

export const HttpClientBorrowerProvider: React.FC<HttpClientProviderProps> = ({ children, baseUrl }) => {
  const httpClient = new HttpClientBorrower(baseUrl);

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

  const borrowerClientFunctions: BorrowerHttpClientContextType = {
    getLoanOffers: httpClient.getLoanOffers.bind(httpClient),
    postLoanOffer: httpClient.postLoanOffer.bind(httpClient),
    postContractRequest: httpClient.postContractRequest.bind(httpClient),
    getContracts: httpClient.getContracts.bind(httpClient),
    getContract: httpClient.getContract.bind(httpClient),
    getClaimCollateralPsbt: httpClient.getClaimCollateralPsbt.bind(httpClient),
    getClaimDisputeCollateralPsbt: httpClient.getClaimDisputeCollateralPsbt.bind(httpClient),
    postClaimTx: httpClient.postClaimTx.bind(httpClient),
    startDispute: httpClient.startDispute.bind(httpClient),
    getDispute: httpClient.getDispute.bind(httpClient),
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      <BorrowerHttpClientContext.Provider value={borrowerClientFunctions}>
        {children}
      </BorrowerHttpClientContext.Provider>
    </BaseHttpClientContext.Provider>
  );
};
