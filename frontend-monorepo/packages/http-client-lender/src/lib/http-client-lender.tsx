import type {
  BaseHttpClientContextType,
  FiatLoanDetails,
} from "@frontend/base-http-client";
import {
  BaseHttpClient,
  BaseHttpClientContext,
} from "@frontend/base-http-client";
import { Dispute, PutUpdateProfile } from "@frontend/http-client-borrower";
import type { AxiosResponse } from "axios";
import axios from "axios";
import { createContext, useContext } from "react";
import {
  BorrowerStats,
  Contract,
  CreateLoanOfferRequest,
  GetLiquidationPsbtResponse,
  GetRecoveryPsbtResponse,
  LenderStats,
  LiquidationToStableCoinPsbt,
  LoanAndContractStats,
  LoanOffer,
} from "./models";
import { parseRFC3339Date } from "./utils";

// Interface for the raw data received from the API
interface RawContract
  extends Omit<Contract, "created_at" | "repaid_at" | "updated_at" | "expiry"> {
  created_at: string;
  updated_at: string;
  expiry: string;
  repaid_at?: string;
}

interface RawDispute extends Omit<Dispute, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

interface RawLoanOffer extends Omit<LoanOffer, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

interface LenderStatsRaw extends Omit<LenderStats, "joined_at"> {
  joined_at: string;
}

interface BorrowerStatsRaw extends Omit<BorrowerStats, "joined_at"> {
  joined_at: string;
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
    location.includes(`upgrade-to-pake`) ||
    location.includes(`waitlist`)
  );
}

export class HttpClientLender extends BaseHttpClient {
  async postLoanOffer(
    offer: CreateLoanOfferRequest,
  ): Promise<LoanOffer | undefined> {
    try {
      const response: AxiosResponse<LoanOffer> = await this.httpClient.post(
        "/api/my-offers/create",
        offer,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response.data);
        console.error(
          `Failed to post loan offer: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not post offer ${JSON.stringify(error)}`);
      }
    }
  }
  async getContracts(): Promise<Contract[]> {
    try {
      const response: AxiosResponse<RawContract[]> =
        await this.httpClient.get("/api/contracts");
      return response.data.map((contract) => {
        const createdAt = parseRFC3339Date(contract.created_at);
        if (createdAt === undefined) {
          throw new Error("Invalid date");
        }

        const updated_at = parseRFC3339Date(contract.updated_at);
        if (updated_at === undefined) {
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

        const expiry = parseRFC3339Date(contract.expiry);
        if (expiry === undefined) {
          throw new Error("Invalid date");
        }

        return {
          ...contract,
          created_at: createdAt,
          updated_at: updated_at,
          repaid_at: repaidAt,
          expiry: expiry,
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response.data);
        console.error(
          `Failed to fetch contracts: http: ${error.response?.status} and response: JSON.stringify(error.response?.data)`,
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
      if (createdAt == null) {
        throw new Error("Invalid date");
      }
      const updated_at = parseRFC3339Date(contract.updated_at);
      if (updated_at == null) {
        throw new Error("Invalid date");
      }
      const repaid_at = parseRFC3339Date(contract.repaid_at);
      if (repaid_at == null) {
        throw new Error("Invalid date");
      }

      const expiry = parseRFC3339Date(contract.expiry);
      if (expiry == null) {
        throw new Error("Invalid date");
      }

      return {
        ...contract,
        created_at: createdAt,
        updated_at: updated_at,
        repaid_at: repaid_at,
        expiry: expiry,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to fetch contract: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch contract ${JSON.stringify(error)}`);
      }
    }
  }

  async approveKyc(borrower_id: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/kyc/${borrower_id}/approve`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to approve KYC: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not approve KYC: ${JSON.stringify(error)}`);
      }
    }
  }

  async rejectKyc(borrower_id: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/kyc/${borrower_id}/reject`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to reject KYC: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not reject KYC: ${JSON.stringify(error)}`);
      }
    }
  }

  async approveContract(
    id: string,
    fiatLoanDetails?: FiatLoanDetails,
  ): Promise<void> {
    try {
      await this.httpClient.put(
        `/api/contracts/${id}/approve`,
        fiatLoanDetails,
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to approve contract: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
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
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to reject contract: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not reject contract ${JSON.stringify(error)}`);
      }
    }
  }

  async principalGiven(id: string, txid?: string): Promise<void> {
    let url = `/api/contracts/${id}/principalgiven`;

    if (txid) {
      url = `${url}?txid=${txid}`;
    }

    try {
      await this.httpClient.put(url);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to mark contract as principal given: http: ${error.response?.status} and response: ${error.response?.data}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to mark contract as principal given ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async markPrincipalConfirmed(id: string): Promise<void> {
    try {
      await this.httpClient.put(`/api/contracts/${id}/principalconfirmed`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to mark contract as repaid: http: ${error.response?.status} and response: ${error.response?.data}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to mark contract as repaid ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getLiquidationToBitcoinPsbt(
    id: string,
    feeRate: number,
    address: string,
  ): Promise<GetLiquidationPsbtResponse> {
    try {
      const res: AxiosResponse<GetLiquidationPsbtResponse> =
        await this.httpClient.get(`/api/contracts/${id}/liquidation-psbt`, {
          params: {
            fee_rate: feeRate,
            address: address,
          },
        });
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message
          ? JSON.stringify(error.response.data.message)
          : error.response.data;
        console.error(
          `Failed to fetch liquidation PSBT: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to fetch liquidation PSBT ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getLiquidationToStablecoinPsbt(
    id: string,
    feeRate: number,
    bitcoinRefundAddress: string,
  ): Promise<LiquidationToStableCoinPsbt> {
    try {
      const res: AxiosResponse<LiquidationToStableCoinPsbt> =
        await this.httpClient.post(
          `/api/contracts/${id}/liquidation-to-stablecoin-psbt`,
          {
            fee_rate_sats_vbyte: feeRate,
            bitcoin_refund_address: bitcoinRefundAddress,
          },
        );
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message
          ? JSON.stringify(error.response.data.message)
          : error.response.data;
        console.error(
          `Failed to fetch liquidation PSBT: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to fetch liquidation PSBT ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async postLiquidationTx(contract_id: string, tx: string): Promise<string> {
    try {
      const response: AxiosResponse<string> = await this.httpClient.post(
        `/api/contracts/${contract_id}/broadcast-liquidation`,
        { tx: tx },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to post liquidation TX: http: ${error.response?.status} and response: ${error.response?.data}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to post liquidation tx ${JSON.stringify(error)}`,
        );
      }
    }
  }

  async getRecoveryPsbt(
    id: string,
    feeRate: number,
    address: string,
  ): Promise<GetRecoveryPsbtResponse> {
    try {
      const res: AxiosResponse<GetRecoveryPsbtResponse> =
        await this.httpClient.get(`/api/contracts/${id}/recovery-psbt`, {
          params: {
            fee_rate: feeRate,
            address: address,
          },
        });
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message
          ? JSON.stringify(error.response.data.message)
          : error.response.data;
        console.error(
          `Failed to fetch recovery PSBT: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(
          `Failed to fetch recovery PSBT ${JSON.stringify(error)}`,
        );
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
        const message = JSON.stringify(error.response?.data);
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
      if (joinedAt == null || joinedAt == null) {
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

  async getAllLoanOffers(): Promise<LoanOffer[]> {
    try {
      const response: AxiosResponse<RawLoanOffer[]> =
        await this.httpClient.get("/api/offers");

      return response.data.map((offer) => {
        const createdAt = parseRFC3339Date(offer.created_at);
        if (createdAt == null) {
          throw new Error("Invalid date");
        }
        const updatedAt = parseRFC3339Date(offer.updated_at);

        if (updatedAt == null) {
          throw new Error("Invalid date");
        }

        return {
          ...offer,
          created_at: createdAt,
          updated_at: updatedAt,
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offers: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offers ${JSON.stringify(error)}`);
      }
    }
  }

  async getLoanOffer(id: string): Promise<LoanOffer> {
    try {
      const response: AxiosResponse<RawLoanOffer> = await this.httpClient.get(
        `/api/offers/${id}`,
      );
      const createdAt = parseRFC3339Date(response.data.created_at);
      if (createdAt == null) {
        throw new Error("Invalid date");
      }
      const updatedAt = parseRFC3339Date(response.data.updated_at);

      if (updatedAt == null) {
        throw new Error("Invalid date");
      }
      return {
        ...response.data,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offer: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offer ${JSON.stringify(error)}`);
      }
    }
  }

  async getMyLoanOffers(): Promise<LoanOffer[]> {
    try {
      const response: AxiosResponse<RawLoanOffer[]> =
        await this.httpClient.get("/api/my-offers");
      return response.data.map((offer) => {
        const createdAt = parseRFC3339Date(offer.created_at);
        if (createdAt == null) {
          throw new Error("Invalid date");
        }
        const updatedAt = parseRFC3339Date(offer.updated_at);

        if (updatedAt == null) {
          throw new Error("Invalid date");
        }

        return {
          ...offer,
          created_at: createdAt,
          updated_at: updatedAt,
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offers: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offers ${JSON.stringify(error)}`);
      }
    }
  }

  async getMyLoanOffer(id: string): Promise<LoanOffer> {
    try {
      const response: AxiosResponse<RawLoanOffer> = await this.httpClient.get(
        `/api/my-offers/${id}`,
      );
      const createdAt = parseRFC3339Date(response.data.created_at);
      if (createdAt == null) {
        throw new Error("Invalid date");
      }
      const updatedAt = parseRFC3339Date(response.data.updated_at);

      if (updatedAt == null) {
        throw new Error("Invalid date");
      }

      return {
        ...response.data,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offer: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offer ${JSON.stringify(error)}`);
      }
    }
  }

  async deleteLoanOffer(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`/api/my-offers/${id}`);
      return;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = error.response.data.message;
        console.error(
          `Failed to fetch offer: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch offer ${JSON.stringify(error)}`);
      }
    }
  }

  async getLoanAndContractStats(): Promise<LoanAndContractStats> {
    try {
      const stats: AxiosResponse<LoanAndContractStats> =
        await this.httpClient.get(`/api/offers/stats`);

      return stats.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const message = JSON.stringify(error.response?.data);
        console.error(
          `Failed to fetch contract: http: ${
            error.response?.status
          } and response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(message);
      } else {
        throw new Error(`Could not fetch contract ${JSON.stringify(error)}`);
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

type LenderHttpClientContextType = Pick<
  HttpClientLender,
  | "postLoanOffer"
  | "getContracts"
  | "getContract"
  | "approveKyc"
  | "rejectKyc"
  | "approveContract"
  | "rejectContract"
  | "principalGiven"
  | "markPrincipalConfirmed"
  | "startDispute"
  | "getDispute"
  | "getLenderProfile"
  | "getBorrowerProfile"
  | "getAllLoanOffers"
  | "getLoanOffer"
  | "getMyLoanOffers"
  | "getMyLoanOffer"
  | "deleteLoanOffer"
  | "getLiquidationToBitcoinPsbt"
  | "getLiquidationToStablecoinPsbt"
  | "postLiquidationTx"
  | "getRecoveryPsbt"
  | "getLoanAndContractStats"
  | "putUpdateProfile"
>;

export const LenderHttpClientContext = createContext<
  LenderHttpClientContextType | undefined
>(undefined);

export const useLenderHttpClient = () => {
  const context = useContext(LenderHttpClientContext);
  if (context === undefined) {
    throw new Error(
      "useBorrowerHttpClient must be used within a BorrowerHttpClientProvider",
    );
  }
  return context;
};

// Create a provider component that will wrap your app
interface HttpClientProviderProps {
  children: React.ReactNode;
  baseUrl: string;
}

export const HttpClientLenderProvider: React.FC<HttpClientProviderProps> = ({
  children,
  baseUrl,
}) => {
  const httpClient = new HttpClientLender(baseUrl);

  const baseClientFunctions: BaseHttpClientContextType = {
    register: httpClient.register.bind(httpClient),
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

  const lenderClientFunctions: LenderHttpClientContextType = {
    postLoanOffer: httpClient.postLoanOffer.bind(httpClient),
    getContracts: httpClient.getContracts.bind(httpClient),
    getContract: httpClient.getContract.bind(httpClient),
    approveContract: httpClient.approveContract.bind(httpClient),
    rejectContract: httpClient.rejectContract.bind(httpClient),
    approveKyc: httpClient.approveKyc.bind(httpClient),
    rejectKyc: httpClient.rejectKyc.bind(httpClient),
    principalGiven: httpClient.principalGiven.bind(httpClient),
    markPrincipalConfirmed: httpClient.markPrincipalConfirmed.bind(httpClient),
    startDispute: httpClient.startDispute.bind(httpClient),
    getDispute: httpClient.getDispute.bind(httpClient),
    getLenderProfile: httpClient.getLenderProfile.bind(httpClient),
    getBorrowerProfile: httpClient.getBorrowerProfile.bind(httpClient),
    getAllLoanOffers: httpClient.getAllLoanOffers.bind(httpClient),
    getLoanOffer: httpClient.getLoanOffer.bind(httpClient),
    getMyLoanOffers: httpClient.getMyLoanOffers.bind(httpClient),
    getMyLoanOffer: httpClient.getMyLoanOffer.bind(httpClient),
    deleteLoanOffer: httpClient.deleteLoanOffer.bind(httpClient),
    getLiquidationToBitcoinPsbt:
      httpClient.getLiquidationToBitcoinPsbt.bind(httpClient),
    getLiquidationToStablecoinPsbt:
      httpClient.getLiquidationToStablecoinPsbt.bind(httpClient),
    postLiquidationTx: httpClient.postLiquidationTx.bind(httpClient),
    getRecoveryPsbt: httpClient.getRecoveryPsbt.bind(httpClient),
    getLoanAndContractStats:
      httpClient.getLoanAndContractStats.bind(httpClient),
    putUpdateProfile: httpClient.putUpdateProfile.bind(httpClient),
  };

  return (
    <BaseHttpClientContext.Provider value={baseClientFunctions}>
      <LenderHttpClientContext.Provider value={lenderClientFunctions}>
        {children}
      </LenderHttpClientContext.Provider>
    </BaseHttpClientContext.Provider>
  );
};
