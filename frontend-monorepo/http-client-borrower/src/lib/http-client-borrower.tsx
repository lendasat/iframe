import type { BaseHttpClientContextType } from "@frontend-monorepo/base-http-client";
import {
  BaseHttpClient,
  BaseHttpClientContext,
} from "@frontend-monorepo/base-http-client";
import type { AxiosResponse } from "axios";
import axios from "axios";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BorrowerStats,
  CardTransaction,
  ClaimCollateralPsbtResponse,
  Contract,
  ContractRequest,
  Dispute,
  ExtendPostLoanRequest,
  LenderStats,
  LoanOffer,
  LoanRequest,
  PostLoanRequest,
  PutUpdateProfile,
  UserCardDetail,
} from "./models";
import { parseRFC3339Date } from "./utils";

// Interface for the raw data received from the API
interface RawContract
  extends Omit<Contract, "created_at" | "repaid_at" | "updated_at" | "expiry"> {
  created_at: string;
  updated_at: string;
  repaid_at?: string;
  expiry: string;
}
interface RawDispute extends Omit<Dispute, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

interface LenderStatsRaw extends Omit<LenderStats, "joined_at"> {
  joined_at: string;
}

interface BorrowerStatsRaw extends Omit<BorrowerStats, "joined_at"> {
  joined_at: string;
}

export class HttpClientBorrower extends BaseHttpClient {
  async getLoanOffers(): Promise<LoanOffer[] | undefined> {
    try {
      const response: AxiosResponse<LoanOffer[]> =
        await this.httpClient.get("/api/offers");
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch loan offers: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch loan offers ${JSON.stringify(error)}`);
      }
    }
  }
  async getLoanOffersByLender(lenderId: string): Promise<LoanOffer[]> {
    try {
      const response: AxiosResponse<LoanOffer[]> = await this.httpClient.get(
        `/api/offersbylender/${lenderId}`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch loan offers: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch loan offers ${JSON.stringify(error)}`);
      }
    }
  }

  async getLoanOffer(id: string): Promise<LoanOffer | undefined> {
    try {
      const response: AxiosResponse<LoanOffer> = await this.httpClient.get(
        `/api/offer/${id}`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch loan offer: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch loan offer ${JSON.stringify(error)}`);
      }
    }
  }

  async postLoanRequest(
    request: PostLoanRequest,
  ): Promise<LoanRequest | undefined> {
    try {
      const response: AxiosResponse<LoanRequest> = await this.httpClient.post(
        "/api/requests/create",
        request,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to post loan request: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Could not post loan request: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async postExtendLoanRequest(
    contractId: string,
    request: ExtendPostLoanRequest,
  ): Promise<LoanRequest | undefined> {
    try {
      const response: AxiosResponse<LoanRequest> = await this.httpClient.post(
        `/api/contracts/${contractId}/extend`,
        request,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to post extend loan request: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Could not post extend loan request: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async postContractRequest(
    request: ContractRequest,
  ): Promise<Contract | undefined> {
    try {
      const response: AxiosResponse<Contract> = await this.httpClient.post(
        "/api/contracts",
        request,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 422) {
          throw new Error(
            `Invalid request: ${JSON.stringify(error.response.data)}`,
          );
        }

        const message = error.response.data.message;
        console.error(
          `Failed to post contract request: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch version ${JSON.stringify(error)}`);
      }
    }
  }

  async cancelContractRequest(contractId: string): Promise<void> {
    try {
      await this.httpClient.delete(`/api/contracts/${contractId}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to cancel loan request: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Could not cancel loan request: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getContracts(): Promise<Contract[]> {
    try {
      const response: AxiosResponse<RawContract[]> =
        await this.httpClient.get("/api/contracts");

      return response.data.map((contract) => {
        const createdAt = parseRFC3339Date(contract.created_at);
        const updatedAt = parseRFC3339Date(contract.updated_at);
        const expiry = parseRFC3339Date(contract.expiry);
        if (
          createdAt === undefined ||
          expiry === undefined ||
          updatedAt === undefined
        ) {
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
          updated_at: updatedAt,
          repaid_at: repaidAt,
          expiry: expiry,
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch contracts: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch contracts ${JSON.stringify(error)}`);
      }
    }
  }

  async getContract(id: string): Promise<Contract> {
    try {
      const contractResponse: AxiosResponse<RawContract> =
        await this.httpClient.get(`/api/contracts/${id}`);
      const contract = contractResponse.data;

      const createdAt = parseRFC3339Date(contract.created_at);
      const updatedAt = parseRFC3339Date(contract.updated_at);
      const repaidAt = parseRFC3339Date(contract.repaid_at);
      const expiry = parseRFC3339Date(contract.expiry);
      if (
        createdAt == null ||
        updatedAt == null ||
        repaidAt == null ||
        expiry == null
      ) {
        throw new Error("Invalid date");
      }

      return {
        ...contract,
        created_at: createdAt,
        updated_at: updatedAt,
        repaid_at: repaidAt,
        expiry: expiry,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch contract: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch contracts ${JSON.stringify(error)}`);
      }
    }
  }

  async markAsRepaymentProvided(id: string, txid: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/contracts/${id}/repaid?txid=${txid}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to mark contract as principal repayment provided: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to mark contract as principal given ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getClaimCollateralPsbt(
    id: string,
    feeRate: number,
  ): Promise<ClaimCollateralPsbtResponse> {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> =
        await this.httpClient.get(
          `/api/contracts/${id}/claim?fee_rate=${feeRate}`,
        );
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch claim-collateral PSBT: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to fetch claim-collateral PSBT ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getClaimDisputeCollateralPsbt(
    disputeId: string,
    feeRate: number,
  ): Promise<ClaimCollateralPsbtResponse> {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> =
        await this.httpClient.get(
          `/api/disputes/${disputeId}/claim?fee_rate=${feeRate}`,
        );
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.log(error.response);
        const message = error.response.data.message;
        console.error(
          `Failed to fetch claim-dispute-collateral PSBT: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Could not fetch claim-dispute-collateral PSBT ${JSON.stringify(
            error,
          )}`,
        );
      }
    }
  }

  async postClaimTx(contract_id: string, tx: string): Promise<string> {
    try {
      const response: AxiosResponse<string> = await this.httpClient.post(
        `/api/contracts/${contract_id}`,
        { tx: tx },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to post claim TX: http: ${error.response?.status} and response: ${error.response?.data}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Failed to post claim tx ${JSON.stringify(error)}`);
      }
    }
  }

  async startDispute(
    contract_id: string,
    reason: string,
    comment: string,
  ): Promise<Dispute> {
    try {
      const response: AxiosResponse<Dispute> = await this.httpClient.post(
        `/api/disputes`,
        {
          contract_id,
          reason,
          comment,
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to create dispute: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not start dispute ${JSON.stringify(error)}`);
      }
    }
  }

  async getDispute(disputeId: string): Promise<Dispute> {
    try {
      const response: AxiosResponse<RawDispute> = await this.httpClient.get(
        `/api/disputes/${disputeId}`,
      );
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
          `Failed to fetch dispute: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch dispute ${JSON.stringify(error)}`);
      }
    }
  }

  async getLenderProfile(id: string): Promise<LenderStats> {
    try {
      const response: AxiosResponse<LenderStatsRaw> = await this.httpClient.get(
        `/api/lenders/${id}`,
      );

      const joinedAt = parseRFC3339Date(response.data.joined_at);
      if (joinedAt == null || joinedAt == null) {
        throw new Error("Invalid date");
      }

      return { ...response.data, joined_at: joinedAt };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch lender profile: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch lender ${JSON.stringify(error)}`);
      }
    }
  }

  async getBorrowerProfile(id: string): Promise<BorrowerStats> {
    try {
      const response: AxiosResponse<BorrowerStatsRaw> =
        await this.httpClient.get(`/api/borrowers/${id}`);

      const joinedAt = parseRFC3339Date(response.data.joined_at);
      if (joinedAt == null) {
        throw new Error("Invalid date");
      }

      return { ...response.data, joined_at: joinedAt };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch borrower profile: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch borrower ${JSON.stringify(error)}`);
      }
    }
  }

  async getUserCards(): Promise<UserCardDetail[]> {
    try {
      const response: AxiosResponse<UserCardDetail[]> =
        await this.httpClient.get("/api/cards");

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch borrower cards: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Could not fetch borrower cards: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getCardTransactions(cardId: string): Promise<CardTransaction[]> {
    try {
      const transactionResponse: AxiosResponse<CardTransaction[]> =
        await this.httpClient.get(`/api/transaction/${cardId}`);
      return transactionResponse.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch borrower cards: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Could not fetch borrower cards: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async putUpdateProfile(request: PutUpdateProfile): Promise<void> {
    try {
      await this.httpClient.put("/api/users/", request);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to update profile: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not update profile: ${JSON.stringify(error)}`);
      }
    }
  }
}

type BorrowerHttpClientContextType = Pick<
  HttpClientBorrower,
  | "getLoanOffers"
  | "getLoanOffersByLender"
  | "getLoanOffer"
  | "postLoanRequest"
  | "postExtendLoanRequest"
  | "postContractRequest"
  | "cancelContractRequest"
  | "getContracts"
  | "getContract"
  | "markAsRepaymentProvided"
  | "getClaimCollateralPsbt"
  | "getClaimDisputeCollateralPsbt"
  | "postClaimTx"
  | "startDispute"
  | "getDispute"
  | "getLenderProfile"
  | "getBorrowerProfile"
  | "getUserCards"
  | "getCardTransactions"
  | "putUpdateProfile"
>;

export const BorrowerHttpClientContext = createContext<
  BorrowerHttpClientContextType | undefined
>(undefined);

export const useBorrowerHttpClient = () => {
  const context = useContext(BorrowerHttpClientContext);
  if (context === undefined) {
    throw new Error(
      "useBorrowerHttpClient must be used within a BorrowerHttpClientProvider",
    );
  }
  return context;
};

// Create a provider component that will wrap your app
interface HttpClientProviderProps {
  children: ReactNode;
  baseUrl: string;
}

export function allowedPagesWithoutLogin(location: string) {
  // These need to be aligned with the routes in app.tsx
  return (
    location.includes(`login`) ||
    location.includes(`registration`) ||
    location.includes(`forgotpassword`) ||
    location.includes(`resetpassword`) ||
    location.includes(`verifyemail`) ||
    location.includes(`logout`) ||
    location.includes(`error`) ||
    location.includes(`upgrade-to-pake`)
  );
}

export const HttpClientBorrowerProvider: React.FC<HttpClientProviderProps> = ({
  children,
  baseUrl,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuthError = () => {
    console.log("Handling error");
    if (allowedPagesWithoutLogin(location.pathname)) {
      // User can stay here :)
      console.log(`User can stay ${location.pathname}`);
      return;
    }

    console.log(`Redirecting to login from ${location.pathname}`);

    navigate("/login", {
      state: { returnUrl: window.location.pathname },
    });
  };

  const httpClient = new HttpClientBorrower(baseUrl, handleAuthError);

  const baseClientFunctions: BaseHttpClientContextType = {
    register: httpClient.register.bind(httpClient),
    login: httpClient.login.bind(httpClient),
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
  };

  const borrowerClientFunctions: BorrowerHttpClientContextType = {
    getLoanOffers: httpClient.getLoanOffers.bind(httpClient),
    getLoanOffersByLender: httpClient.getLoanOffersByLender.bind(httpClient),
    getLoanOffer: httpClient.getLoanOffer.bind(httpClient),
    postLoanRequest: httpClient.postLoanRequest.bind(httpClient),
    postExtendLoanRequest: httpClient.postExtendLoanRequest.bind(httpClient),
    postContractRequest: httpClient.postContractRequest.bind(httpClient),
    cancelContractRequest: httpClient.cancelContractRequest.bind(httpClient),
    getContracts: httpClient.getContracts.bind(httpClient),
    getContract: httpClient.getContract.bind(httpClient),
    markAsRepaymentProvided:
      httpClient.markAsRepaymentProvided.bind(httpClient),
    getClaimCollateralPsbt: httpClient.getClaimCollateralPsbt.bind(httpClient),
    getClaimDisputeCollateralPsbt:
      httpClient.getClaimDisputeCollateralPsbt.bind(httpClient),
    postClaimTx: httpClient.postClaimTx.bind(httpClient),
    startDispute: httpClient.startDispute.bind(httpClient),
    getDispute: httpClient.getDispute.bind(httpClient),
    getLenderProfile: httpClient.getLenderProfile.bind(httpClient),
    getBorrowerProfile: httpClient.getBorrowerProfile.bind(httpClient),
    getUserCards: httpClient.getUserCards.bind(httpClient),
    getCardTransactions: httpClient.getCardTransactions.bind(httpClient),
    putUpdateProfile: httpClient.putUpdateProfile.bind(httpClient),
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      <BorrowerHttpClientContext.Provider value={borrowerClientFunctions}>
        {children}
      </BorrowerHttpClientContext.Provider>
    </BaseHttpClientContext.Provider>
  );
};
