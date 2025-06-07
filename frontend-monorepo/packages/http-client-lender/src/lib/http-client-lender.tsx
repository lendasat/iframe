import type { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode, FC } from "react";
import {
  BorrowerStats,
  Contract,
  ContractDispute,
  ContractDisputeMessage,
  CreateLoanOfferRequest,
  Dispute,
  DisputeWithMessages,
  ExtensionPolicy,
  FiatLoanDetails,
  GetLiquidationPsbtResponse,
  GetRecoveryPsbtResponse,
  LenderStats,
  LiquidationToStableCoinPsbt,
  LoanAndContractStats,
  LoanApplication,
  LoanOffer,
  MeResponse,
  NotifyUser,
  PakeLoginResponseOrUpgrade,
  PakeVerifyResponse,
  PutUpdateProfile,
  TakeLoanApplicationSchema,
  UpgradeToPakeResponse,
  Version,
  IsRegisteredResponse,
  WalletBackupData,
  PaginatedNotificationResponse,
} from "./models";
import { isAllowedPageWithoutLogin, parseRFC3339Date } from "./utils";

// Interface for the raw data received from the API
interface RawContract
  extends Omit<Contract, "created_at" | "updated_at" | "expiry"> {
  created_at: string;
  updated_at: string;
  expiry: string;
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

interface RawLoanApplication
  extends Omit<LoanApplication, "created_at" | "updated_at"> {
  created_at: string;
  updated_at: string;
}

interface RawContractDispute
  extends Omit<ContractDispute, "created_at" | "updated_at" | "resolved_at"> {
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

interface RawContractDisputeMessage
  extends Omit<ContractDisputeMessage, "created_at"> {
  created_at: string;
}

interface RawDisputeWithMessages extends RawContractDispute {
  messages: RawContractDisputeMessage[];
}

// Define the shape of our client
export interface HttpClientLender {
  // Auth related methods
  register: (
    name: string,
    email: string,
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    inviteCode?: string,
  ) => Promise<void>;
  upgradeToPake: (
    email: string,
    oldPassword: string,
  ) => Promise<UpgradeToPakeResponse>;
  finishUpgradeToPake: (
    email: string,
    oldPassword: string,
    verifier: string,
    salt: string,
    newWalletBackupData: WalletBackupData,
  ) => Promise<undefined>;
  pakeLoginRequest: (email: string) => Promise<PakeLoginResponseOrUpgrade>;
  pakeVerifyRequest: (
    email: string,
    aPub: string,
    clientProof: string,
  ) => Promise<PakeVerifyResponse>;
  forgotPassword: (email: string) => Promise<string>;
  verifyEmail: (token: string) => Promise<string>;
  getIsRegistered: (email: string) => Promise<IsRegisteredResponse>;
  resetPassword: (
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    passwordResetToken: string,
  ) => Promise<string>;
  getVersion: () => Promise<Version>;
  joinWaitlist: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  me: () => Promise<MeResponse>;
  check: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Loan related methods
  postLoanOffer: (offer: CreateLoanOfferRequest) => Promise<LoanOffer>;
  getAllLoanOffers: () => Promise<LoanOffer[]>;
  getMyLoanOffers: () => Promise<LoanOffer[]>;
  getMyLoanOffer: (id: string) => Promise<LoanOffer>;
  deleteLoanOffer: (id: string) => Promise<void>;
  getLoanAndContractStats: () => Promise<LoanAndContractStats>;

  // Loan application methods
  getLoanApplications: () => Promise<LoanApplication[]>;
  getLoanApplication: (id: string) => Promise<LoanApplication>;
  takeLoanApplication: (
    id: string,
    body: TakeLoanApplicationSchema,
  ) => Promise<string>;

  // Contract related methods
  getContracts: () => Promise<Contract[]>;
  getContract: (id: string) => Promise<Contract>;
  approveContract: (
    id: string,
    fiatLoanDetails?: FiatLoanDetails,
  ) => Promise<void>;
  rejectContract: (id: string) => Promise<void>;
  rejectContractExtension: (id: string) => Promise<void>;
  reportDisbursement: (id: string, txid?: string) => Promise<void>;
  markInstallmentAsConfirmed: (
    contractId: string,
    installmentId: string,
  ) => Promise<void>;
  updateExtensionPolicy: (
    contractId: string,
    extensionPolicy: ExtensionPolicy,
  ) => Promise<void>;

  // Liquidation and recovery methods
  getLiquidationToBitcoinPsbt: (
    id: string,
    feeRate: number,
    address: string,
  ) => Promise<GetLiquidationPsbtResponse>;
  getLiquidationToStablecoinPsbt: (
    id: string,
    feeRate: number,
    bitcoinRefundAddress: string,
  ) => Promise<LiquidationToStableCoinPsbt>;
  postLiquidationTx: (contractId: string, tx: string) => Promise<string>;
  getRecoveryPsbt: (
    id: string,
    feeRate: number,
    address: string,
  ) => Promise<GetRecoveryPsbtResponse>;

  // KYC methods
  approveKyc: (borrowerId: string) => Promise<void>;
  rejectKyc: (borrowerId: string) => Promise<void>;

  // Profile methods
  getLenderProfile: (id: string) => Promise<LenderStats>;
  getBorrowerProfile: (id: string) => Promise<BorrowerStats>;
  putUpdateProfile: (request: PutUpdateProfile) => Promise<void>;

  // Dispute methods
  startDispute: (
    contractId: string,
    reason: string,
    comment: string,
  ) => Promise<Dispute>;
  getDispute: (disputeId: string) => Promise<Dispute>;
  resolveDispute: (disputeId: string) => Promise<void>;
  fetchDisputeWithMessages: (
    contractId: string,
  ) => Promise<DisputeWithMessages[]>;
  commentOnDispute: (disputeId: string, message: string) => Promise<void>;

  // Chat methods
  newChatNotification: (request: NotifyUser) => Promise<void>;

  // fetch notifications
  fetchNotifications: (
    page: number,
    limit: number,
    showUnreadOnly: boolean,
  ) => Promise<PaginatedNotificationResponse>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationAsRead: () => Promise<void>;
}

// Create a factory function to create our client
export const createHttpClientLender = (
  baseUrl: string,
  onAuthError?: () => void,
): HttpClientLender => {
  console.log(`Creating HTTP client for ${baseUrl}`);

  // Create axios instance
  const axiosClient: AxiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
  });

  // Add response interceptor for handling 401s
  axiosClient.interceptors.response.use(
    async (response) => {
      return response;
    },
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        if (!isAllowedPageWithoutLogin(window.location.pathname)) {
          if (onAuthError) {
            onAuthError();
          }
        }
      }
      return Promise.reject(error);
    },
  );

  // Common error handler
  const handleError = (error: unknown, context: string) => {
    if (axios.isAxiosError(error) && error.response) {
      const message =
        error.response.data.message || JSON.stringify(error.response.data);
      console.debug(
        `Failed ${context}: http: ${error.response?.status} and response: ${JSON.stringify(error.response?.data)}`,
      );
      throw new Error(message);
    }

    throw new Error(`Failed ${context}: ${error}`);
  };

  // Auth related methods
  const getIsRegistered = async (email: string) => {
    try {
      const response: AxiosResponse<IsRegisteredResponse> =
        await axiosClient.get(`/api/auth/is-registered?email=${email}`);
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
  };

  const register = async (
    name: string,
    email: string,
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    inviteCode?: string,
  ): Promise<void> => {
    try {
      await axiosClient.post("/api/auth/register", {
        name,
        email,
        verifier,
        salt,
        wallet_backup_data: walletBackupData,
        invite_code: inviteCode,
      });
    } catch (error) {
      handleError(error, "registration");
    }
  };

  const upgradeToPake = async (
    email: string,
    oldPassword: string,
  ): Promise<UpgradeToPakeResponse> => {
    try {
      const [response] = await Promise.all([
        axiosClient.post("/api/auth/upgrade-to-pake", {
          email,
          old_password: oldPassword,
        }),
      ]);
      const data = response.data as UpgradeToPakeResponse;
      console.log(`Got upgrade-to-PAKE response`);
      return data;
    } catch (error) {
      handleError(error, "upgrade to pake");
      throw error;
    }
  };

  const finishUpgradeToPake = async (
    email: string,
    oldPassword: string,
    verifier: string,
    salt: string,
    newWalletBackupData: WalletBackupData,
  ): Promise<undefined> => {
    try {
      await Promise.all([
        axiosClient.post("/api/auth/finish-upgrade-to-pake", {
          email,
          old_password: oldPassword,
          verifier,
          salt,
          new_wallet_backup_data: newWalletBackupData,
        }),
      ]);
      console.log(`Upgraded to PAKE`);
      return;
    } catch (error) {
      handleError(error, "finishing upgrade to pake");
      throw error;
    }
  };

  const pakeLoginRequest = async (
    email: string,
  ): Promise<PakeLoginResponseOrUpgrade> => {
    try {
      const response = await axiosClient.post("/api/auth/pake-login", {
        email,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const message = error.response.data.message;
        if (message === "upgrade-to-pake") {
          return { must_upgrade_to_pake: undefined };
        }
      }
      handleError(error, "PAKE login");
      throw error;
    }
  };

  const pakeVerifyRequest = async (
    email: string,
    aPub: string,
    clientProof: string,
  ): Promise<PakeVerifyResponse> => {
    try {
      const response = await axiosClient.post("/api/auth/pake-verify", {
        email,
        a_pub: aPub,
        client_proof: clientProof,
      });
      return response.data;
    } catch (error) {
      handleError(error, "PAKE verification");
      throw error;
    }
  };

  const forgotPassword = async (email: string): Promise<string> => {
    try {
      const response = await axiosClient.post("/api/auth/forgotpassword", {
        email: email,
      });
      return response.data.message;
    } catch (error) {
      handleError(error, "posting forget password");
      throw error;
    }
  };

  const verifyEmail = async (token: string): Promise<string> => {
    try {
      const response = await axiosClient.get(`/api/auth/verifyemail/${token}`);
      return response.data.message;
    } catch (error) {
      handleError(error, "verifying email");
      throw error;
    }
  };

  const resetPassword = async (
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    passwordResetToken: string,
  ): Promise<string> => {
    try {
      const response = await axiosClient.put(
        `/api/auth/resetpassword/${passwordResetToken}`,
        {
          verifier,
          salt,
          new_wallet_backup_data: walletBackupData,
        },
      );
      return response.data.message;
    } catch (error) {
      handleError(error, "resetting password");
      throw error;
    }
  };

  const getVersion = async (): Promise<Version> => {
    try {
      const response: AxiosResponse<Version> =
        await axiosClient.get("/api/version");
      return response.data;
    } catch (error) {
      handleError(error, "getting version");
      throw error;
    }
  };

  const joinWaitlist = async (email: string): Promise<void> => {
    try {
      await axiosClient.post("/api/auth/waitlist", {
        email,
      });
    } catch (error) {
      handleError(error, "joining waitlist");
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await axiosClient.get("/api/auth/logout");
    } catch (error) {
      handleError(error, "logout");
    }
  };

  const me = async (): Promise<MeResponse> => {
    try {
      const response = await axiosClient.get("/api/users/me");
      return response.data;
    } catch (error) {
      console.log(`error received`);
      handleError(error, "fetching user data");
      throw error;
    }
  };

  const check = async (): Promise<void> => {
    try {
      await axiosClient.get("/api/auth/check");
    } catch (error) {
      console.log;
      handleError(error, "auth check");
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      await axiosClient.post("/api/auth/refresh-token");
      console.log("refreshed token");
    } catch (error) {
      handleError(error, "refresh token");
    }
  };

  // Loan related methods
  const postLoanOffer = async (
    offer: CreateLoanOfferRequest,
  ): Promise<LoanOffer> => {
    try {
      const response: AxiosResponse<LoanOffer> = await axiosClient.post(
        "/api/offers/create",
        offer,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting loan offer");
      throw error;
    }
  };

  const getAllLoanOffers = async (): Promise<LoanOffer[]> => {
    try {
      const response: AxiosResponse<RawLoanOffer[]> =
        await axiosClient.get("/api/offers");

      return response.data.map((offer) => {
        const createdAt = parseRFC3339Date(offer.created_at);
        const updatedAt = parseRFC3339Date(offer.updated_at);
        if (createdAt === undefined || updatedAt === undefined) {
          throw new Error("Invalid date");
        }

        return {
          ...offer,
          created_at: createdAt,
          updated_at: updatedAt,
        };
      });
    } catch (error) {
      handleError(error, "fetching loan offers");
      throw error;
    }
  };

  const getMyLoanOffers = async (): Promise<LoanOffer[]> => {
    try {
      const response: AxiosResponse<RawLoanOffer[]> =
        await axiosClient.get("/api/offers/own");
      return response.data.map((offer) => {
        const createdAt = parseRFC3339Date(offer.created_at);
        const updatedAt = parseRFC3339Date(offer.updated_at);

        if (createdAt === undefined || updatedAt === undefined) {
          throw new Error("Invalid date");
        }

        return {
          ...offer,
          created_at: createdAt,
          updated_at: updatedAt,
        };
      });
    } catch (error) {
      handleError(error, "fetching my loan offers");
      throw error;
    }
  };

  const getMyLoanOffer = async (id: string): Promise<LoanOffer> => {
    try {
      const response: AxiosResponse<RawLoanOffer> = await axiosClient.get(
        `/api/offers/own/${id}`,
      );
      const createdAt = parseRFC3339Date(response.data.created_at);
      const updatedAt = parseRFC3339Date(response.data.updated_at);

      if (createdAt === undefined || updatedAt === undefined) {
        throw new Error("Invalid date");
      }

      return {
        ...response.data,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    } catch (error) {
      handleError(error, "fetching my loan offer");
      throw error;
    }
  };

  const deleteLoanOffer = async (id: string): Promise<void> => {
    try {
      await axiosClient.delete(`/api/offers/${id}`);
    } catch (error) {
      handleError(error, "deleting loan offer");
    }
  };

  const getLoanAndContractStats = async (): Promise<LoanAndContractStats> => {
    try {
      const stats: AxiosResponse<LoanAndContractStats> =
        await axiosClient.get(`/api/offers/stats`);
      return stats.data;
    } catch (error) {
      handleError(error, "fetching loan and contract stats");
      throw error;
    }
  };

  // Loan application methods
  const getLoanApplications = async (): Promise<LoanApplication[]> => {
    try {
      const response: AxiosResponse<RawLoanApplication[]> =
        await axiosClient.get("/api/loan-applications");

      return response.data.map((application) => {
        const createdAt = parseRFC3339Date(application.created_at);
        const updatedAt = parseRFC3339Date(application.updated_at);
        if (createdAt === undefined || updatedAt === undefined) {
          throw new Error("Invalid date");
        }

        return {
          ...application,
          created_at: createdAt,
          updated_at: updatedAt,
        };
      });
    } catch (error) {
      handleError(error, "fetching loan applications");
      throw error;
    }
  };

  const getLoanApplication = async (id: string): Promise<LoanApplication> => {
    try {
      const response: AxiosResponse<RawLoanApplication> = await axiosClient.get(
        `/api/loan-applications/${id}`,
      );
      const application = response.data;
      const createdAt = parseRFC3339Date(application.created_at);
      const updatedAt = parseRFC3339Date(application.updated_at);
      if (createdAt === undefined || updatedAt === undefined) {
        throw new Error("Invalid date");
      }

      return {
        ...application,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    } catch (error) {
      handleError(error, "fetching loan application");
      throw error;
    }
  };

  const takeLoanApplication = async (
    id: string,
    body: TakeLoanApplicationSchema,
  ): Promise<string> => {
    try {
      const response: AxiosResponse<string> = await axiosClient.post(
        `/api/loan-applications/${id}`,
        body,
      );
      return response.data;
    } catch (error) {
      handleError(error, "taking loan application");
      throw error;
    }
  };

  // Contract related methods
  const getContracts = async (): Promise<Contract[]> => {
    try {
      const response: AxiosResponse<RawContract[]> =
        await axiosClient.get("/api/contracts");
      return response.data.map((contract) => {
        const createdAt = parseRFC3339Date(contract.created_at);
        const updatedAt = parseRFC3339Date(contract.updated_at);
        const expiry = parseRFC3339Date(contract.expiry);

        if (
          createdAt === undefined ||
          updatedAt === undefined ||
          expiry === undefined
        ) {
          throw new Error("Invalid date");
        }

        return {
          ...contract,
          created_at: createdAt,
          updated_at: updatedAt,
          expiry: expiry,
        };
      });
    } catch (error) {
      handleError(error, "fetching contracts");
      throw error;
    }
  };

  const getContract = async (id: string): Promise<Contract> => {
    try {
      const contractResponse: AxiosResponse<RawContract> =
        await axiosClient.get(`/api/contracts/${id}`);
      const contract = contractResponse.data;

      const createdAt = parseRFC3339Date(contract.created_at);
      const updatedAt = parseRFC3339Date(contract.updated_at);
      const expiry = parseRFC3339Date(contract.expiry);

      if (createdAt === null || updatedAt === null || expiry === null) {
        throw new Error("Invalid date");
      }

      return {
        ...contract,
        created_at: createdAt!,
        updated_at: updatedAt!,
        expiry: expiry!,
      };
    } catch (error) {
      handleError(error, "fetching contract");
      throw error;
    }
  };

  const approveContract = async (
    id: string,
    fiatLoanDetails?: FiatLoanDetails,
  ): Promise<void> => {
    try {
      await axiosClient.put(`/api/contracts/${id}/approve`, fiatLoanDetails);
    } catch (error) {
      handleError(error, "approving contract");
    }
  };

  const rejectContract = async (id: string): Promise<void> => {
    try {
      await axiosClient.delete(`/api/contracts/${id}/reject`);
    } catch (error) {
      handleError(error, "rejecting contract");
    }
  };

  const rejectContractExtension = async (id: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/contracts/${id}/reject-extension`);
    } catch (error) {
      handleError(error, "rejecting contract extension");
    }
  };

  const reportDisbursement = async (
    id: string,
    txid?: string,
  ): Promise<void> => {
    try {
      let url = `/api/contracts/${id}/report-disbursement`;
      if (txid) {
        url = `${url}?txid=${txid}`;
      }
      await axiosClient.put(url);
    } catch (error) {
      handleError(error, "marking contract as principal given");
    }
  };

  const markInstallmentAsConfirmed = async (
    contractId: string,
    installmentId: string,
  ): Promise<void> => {
    try {
      await axiosClient.put(
        `/api/contracts/${contractId}/confirm-installment`,
        { installment_id: installmentId },
      );
    } catch (error) {
      handleError(error, "marking installment as confirmed");
    }
  };

  const updateExtensionPolicy = async (
    contractId: string,
    extensionPolicy: ExtensionPolicy,
  ): Promise<void> => {
    try {
      await axiosClient.put(
        `/api/contracts/${contractId}/extension-policy`,
        extensionPolicy,
      );
    } catch (error) {
      handleError(error, "updating extension policy");
    }
  };

  // Liquidation and recovery methods
  const getLiquidationToBitcoinPsbt = async (
    id: string,
    feeRate: number,
    address: string,
  ): Promise<GetLiquidationPsbtResponse> => {
    try {
      const res: AxiosResponse<GetLiquidationPsbtResponse> =
        await axiosClient.get(`/api/contracts/${id}/liquidation-psbt`, {
          params: {
            fee_rate: feeRate,
            address: address,
          },
        });
      return res.data;
    } catch (error) {
      handleError(error, "fetching liquidation PSBT");
      throw error;
    }
  };

  const getLiquidationToStablecoinPsbt = async (
    id: string,
    feeRate: number,
    bitcoinRefundAddress: string,
  ): Promise<LiquidationToStableCoinPsbt> => {
    try {
      const res: AxiosResponse<LiquidationToStableCoinPsbt> =
        await axiosClient.post(
          `/api/contracts/${id}/liquidation-to-stablecoin-psbt`,
          {
            fee_rate_sats_vbyte: feeRate,
            bitcoin_refund_address: bitcoinRefundAddress,
          },
        );
      return res.data;
    } catch (error) {
      handleError(error, "fetching liquidation to stablecoin PSBT");
      throw error;
    }
  };

  const postLiquidationTx = async (
    contractId: string,
    tx: string,
  ): Promise<string> => {
    try {
      const response: AxiosResponse<string> = await axiosClient.post(
        `/api/contracts/${contractId}/broadcast-liquidation`,
        { tx: tx },
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting liquidation transaction");
      throw error;
    }
  };

  const getRecoveryPsbt = async (
    id: string,
    feeRate: number,
    address: string,
  ): Promise<GetRecoveryPsbtResponse> => {
    try {
      const res: AxiosResponse<GetRecoveryPsbtResponse> = await axiosClient.get(
        `/api/contracts/${id}/recovery-psbt`,
        {
          params: {
            fee_rate: feeRate,
            address: address,
          },
        },
      );
      return res.data;
    } catch (error) {
      handleError(error, "fetching recovery PSBT");
      throw error;
    }
  };

  // KYC methods
  const approveKyc = async (borrowerId: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/kyc/${borrowerId}/approve`);
    } catch (error) {
      handleError(error, "approving KYC");
    }
  };

  const rejectKyc = async (borrowerId: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/kyc/${borrowerId}/reject`);
    } catch (error) {
      handleError(error, "rejecting KYC");
    }
  };

  // Profile methods
  const getLenderProfile = async (id: string): Promise<LenderStats> => {
    try {
      const response: AxiosResponse<LenderStatsRaw> = await axiosClient.get(
        `/api/lenders/${id}`,
      );

      const joinedAt = parseRFC3339Date(response.data.joined_at);
      if (joinedAt === undefined) {
        throw new Error("Invalid date");
      }

      return { ...response.data, joined_at: joinedAt };
    } catch (error) {
      handleError(error, "getting lender profile");
      throw error;
    }
  };

  const getBorrowerProfile = async (id: string): Promise<BorrowerStats> => {
    try {
      const response: AxiosResponse<BorrowerStatsRaw> = await axiosClient.get(
        `/api/borrowers/${id}`,
      );

      const joinedAt = parseRFC3339Date(response.data.joined_at);
      if (joinedAt === undefined) {
        throw new Error("Invalid date");
      }

      return { ...response.data, joined_at: joinedAt };
    } catch (error) {
      handleError(error, "getting borrower profile");
      throw error;
    }
  };

  const putUpdateProfile = async (request: PutUpdateProfile): Promise<void> => {
    try {
      await axiosClient.put("/api/users/", request);
    } catch (error) {
      handleError(error, "updating profile");
    }
  };

  // Dispute methods
  const startDispute = async (
    contractId: string,
    reason: string,
    comment: string,
  ): Promise<Dispute> => {
    try {
      const response: AxiosResponse<Dispute> = await axiosClient.post(
        `/api/disputes`,
        {
          contract_id: contractId,
          reason,
          comment,
        },
      );
      return response.data;
    } catch (error) {
      handleError(error, "starting dispute");
      throw error;
    }
  };

  const getDispute = async (disputeId: string): Promise<Dispute> => {
    try {
      const response: AxiosResponse<RawDispute> = await axiosClient.get(
        `/api/disputes/${disputeId}`,
      );
      const dispute = response.data;

      const createdAt = parseRFC3339Date(dispute.created_at);
      const updatedAt = parseRFC3339Date(dispute.updated_at);
      if (createdAt === undefined || updatedAt === undefined) {
        throw new Error("Invalid date");
      }

      return {
        ...dispute,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    } catch (error) {
      handleError(error, "fetching dispute");
      throw error;
    }
  };

  const resolveDispute = async (disputeId: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/disputes/${disputeId}/resolve`);
    } catch (error) {
      handleError(error, "resolving dispute");
    }
  };

  const fetchDisputeWithMessages = async (
    contractId: string,
  ): Promise<DisputeWithMessages[]> => {
    try {
      const response: AxiosResponse<RawDisputeWithMessages[]> =
        await axiosClient.get(`/api/disputes?contract_id=${contractId}`);
      const rawDisputes = response.data;

      // Handle empty response
      if (!rawDisputes || rawDisputes.length === 0) {
        return [];
      }

      // Process each dispute in the list
      return rawDisputes.map((rawDispute) => {
        // Parse the main dispute dates
        const createdAt = parseRFC3339Date(rawDispute.created_at);
        const updatedAt = parseRFC3339Date(rawDispute.updated_at);

        // Optional date that might be null
        let resolvedAt = undefined;
        if (rawDispute.resolved_at) {
          resolvedAt = parseRFC3339Date(rawDispute.resolved_at);
          if (resolvedAt === null) {
            throw new Error(
              `Invalid resolved_at date format in dispute ID: ${rawDispute.id}`,
            );
          }
        }

        if (createdAt === null || updatedAt === null) {
          throw new Error(
            `Invalid date format in dispute ID: ${rawDispute.id}`,
          );
        }

        // Parse dates in all messages
        const parsedMessages: ContractDisputeMessage[] = (
          rawDispute.messages || []
        ).map((msg) => {
          const messageCreatedAt = parseRFC3339Date(msg.created_at);
          if (messageCreatedAt === null) {
            throw new Error(`Invalid date format in message ID: ${msg.id}`);
          }

          return {
            dispute_id: msg.dispute_id,
            created_at: messageCreatedAt!,
            message: msg.message,
            id: msg.id,
            is_read: msg.is_read,
            sender_id: msg.sender_id,
            sender_type: msg.sender_type,
          };
        });

        return {
          ...rawDispute,
          created_at: createdAt!,
          updated_at: updatedAt!,
          resolved_at: resolvedAt,
          messages: parsedMessages,
        };
      });
    } catch (error) {
      handleError(error, "fetching disputes with messages");
      throw error;
    }
  };

  const commentOnDispute = async (
    disputeId: string,
    message: string,
  ): Promise<void> => {
    try {
      await axiosClient.put(`/api/disputes/${disputeId}`, {
        message: message,
      });
    } catch (error) {
      handleError(error, "commenting on dispute");
    }
  };

  // Chat methods
  const newChatNotification = async (request: NotifyUser): Promise<void> => {
    try {
      await axiosClient.post("/api/chat/notification", request);
    } catch (error) {
      handleError(error, "posting new chat message");
    }
  };

  // fetch notifications
  const fetchNotifications = async (
    page: number = 1,
    limit: number = 20,
    showReadOnly: boolean = true,
  ): Promise<PaginatedNotificationResponse> => {
    try {
      let url = `/api/notifications?page=${page}&limit=${limit}&unread_only=${showReadOnly}`;
      const response = await axiosClient.get(url);
      return response.data;
    } catch (error) {
      handleError(error, "fetching notifications");
      throw error;
    }
  };
  // fetch notifications
  const markNotificationAsRead = async (id: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/notifications/${id}`);
    } catch (error) {
      handleError(error, "marking notification as read");
      throw error;
    }
  };

  // fetch notifications
  const markAllNotificationAsRead = async (): Promise<void> => {
    try {
      await axiosClient.put(`/api/notifications`);
    } catch (error) {
      handleError(error, "marking all notifications as read");
      throw error;
    }
  };

  // Return all functions bundled as our client
  return {
    register,
    upgradeToPake,
    finishUpgradeToPake,
    pakeLoginRequest,
    pakeVerifyRequest,
    forgotPassword,
    verifyEmail,
    getIsRegistered,
    resetPassword,
    getVersion,
    joinWaitlist,
    logout,
    me,
    check,
    refreshToken,
    postLoanOffer,
    getAllLoanOffers,
    getMyLoanOffers,
    getMyLoanOffer,
    deleteLoanOffer,
    getLoanAndContractStats,
    getLoanApplications,
    getLoanApplication,
    takeLoanApplication,
    getContracts,
    getContract,
    approveContract,
    rejectContract,
    rejectContractExtension,
    reportDisbursement,
    markInstallmentAsConfirmed,
    updateExtensionPolicy,
    getLiquidationToBitcoinPsbt,
    getLiquidationToStablecoinPsbt,
    postLiquidationTx,
    getRecoveryPsbt,
    approveKyc,
    rejectKyc,
    getLenderProfile,
    getBorrowerProfile,
    putUpdateProfile,
    startDispute,
    getDispute,
    resolveDispute,
    fetchDisputeWithMessages,
    commentOnDispute,
    newChatNotification,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationAsRead,
  };
};

// Create the context
export const HttpClientLenderContext = createContext<
  HttpClientLender | undefined
>(undefined);

// Custom hook to use the API client
export const useLenderHttpClient = () => {
  const context = useContext(HttpClientLenderContext);
  if (context === undefined) {
    throw new Error(
      "useLenderHttpClient must be used within a HttpClientLenderProvider",
    );
  }
  return context;
};

// Provider component
interface HttpClientLenderProviderProps {
  children: ReactNode;
  baseUrl: string;
}

export const HttpClientLenderProvider: FC<HttpClientLenderProviderProps> = ({
  children,
  baseUrl,
}) => {
  const client = useMemo(() => {
    return createHttpClientLender(baseUrl);
  }, [baseUrl]);

  return (
    <HttpClientLenderContext.Provider value={client}>
      {children}
    </HttpClientLenderContext.Provider>
  );
};
