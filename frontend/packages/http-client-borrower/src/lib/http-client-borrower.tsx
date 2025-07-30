import type { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode, FC } from "react";
import type {
  BorrowerStats,
  CardTransaction,
  ClaimCollateralPsbtResponse,
  Contract,
  ContractDispute,
  ContractDisputeMessage,
  ContractRequest,
  Dispute,
  DisputeWithMessages,
  ExtendPostLoanRequest,
  LenderStats,
  LoanApplication,
  LoanOffer,
  LoanRequest,
  MeResponse,
  NotifyUser,
  PostLoanApplication,
  PutUpdateProfile,
  PakeLoginResponseOrUpgrade,
  PakeVerifyResponse,
  UpgradeToPakeResponse,
  UserCardDetail,
  Version,
  WalletBackupData,
  HasApiKey,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  BringinConnectResponse,
  FiatLoanDetails,
  PaginatedNotificationResponse,
  BorrowerNotificationSettings,
} from "./models";
import { isAllowedPageWithoutLogin, parseRFC3339Date } from "./utils";
import { IsRegisteredResponse } from "@frontend/base-http-client";

// Interface for the raw data received from the API
interface RawContract
  extends Omit<Contract, "created_at" | "updated_at" | "expiry"> {
  created_at: string;
  updated_at: string;
  expiry: string;
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

// Define the shape of our client
// Pagination types
interface PaginationQuery {
  page?: number;
  limit?: number;
}

interface PaginatedContractsResponse {
  data: RawContract[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface HttpClient {
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
  getDirectLoanOffers: () => Promise<LoanOffer[]>;
  getDirectLoanOffersByLender: (lenderId: string) => Promise<LoanOffer[]>;
  getIndirectLoanOffersByLender: (lenderId: string) => Promise<LoanOffer[]>;
  getLoanOffer: (id: string) => Promise<LoanOffer>;
  postLoanApplication: (request: PostLoanApplication) => Promise<LoanRequest>;
  getLoanApplications: () => Promise<LoanApplication[]>;
  editLoanApplication: (
    id: string,
    loan_amount: number,
    duration_days: number,
    interest_rate: number,
    ltv: number,
  ) => Promise<void>;
  deleteLoanApplication: (id: string) => Promise<void>;
  postExtendLoanRequest: (
    contractId: string,
    request: ExtendPostLoanRequest,
  ) => Promise<LoanRequest>;
  postContractRequest: (request: ContractRequest) => Promise<Contract>;
  cancelContractRequest: (contractId: string) => Promise<void>;

  // Contract related methods
  getContracts: (pagination?: PaginationQuery) => Promise<{
    data: Contract[];
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  }>;
  getContract: (id: string) => Promise<Contract>;
  markInstallmentAsPaid: (
    contractId: string,
    installmentId: string,
    paymentId: string,
  ) => Promise<void>;
  getClaimCollateralPsbt: (
    id: string,
    feeRate: number,
  ) => Promise<ClaimCollateralPsbtResponse>;
  getClaimDisputeCollateralPsbt: (
    disputeId: string,
    feeRate: number,
  ) => Promise<ClaimCollateralPsbtResponse>;
  postClaimTx: (contract_id: string, tx: string) => Promise<string>;
  putFiatDetails: (
    contractId: string,
    fiatDetails: FiatLoanDetails,
  ) => Promise<void>;
  updateBorrowerBtcAddress: (
    contract_id: string,
    address: string,
    message: string,
    recoverableSignatureHex: string,
    recoverableSignatureId: number,
  ) => Promise<void>;

  // Dispute methods
  startDispute: (
    contract_id: string,
    reason: string,
    comment: string,
  ) => Promise<Dispute>;
  resolveDispute: (disputeId: string) => Promise<void>;
  fetchDisputeWithMessages: (
    contractId: string,
  ) => Promise<DisputeWithMessages[]>;
  commentOnDispute: (disputeId: string, message: string) => Promise<void>;
  getDispute: (disputeId: string) => Promise<Dispute>;

  // Profile methods
  getLenderProfile: (id: string) => Promise<LenderStats>;
  getBorrowerProfile: (id: string) => Promise<BorrowerStats>;
  putUpdateLocale: (locale?: string) => Promise<void>;
  putUpdateProfile: (request: PutUpdateProfile) => Promise<void>;

  // Card moon methods
  getUserCards: () => Promise<UserCardDetail[]>;
  getCardTransactions: (cardId: string) => Promise<CardTransaction[]>;

  newChatNotification: (request: NotifyUser) => Promise<void>;

  // Bringin methods
  postBringinConnect: (bringinEmail: string) => Promise<BringinConnectResponse>;
  hasBringinApiKey: () => Promise<boolean>;

  // fetch notifications
  fetchNotifications: (
    page: number,
    limit: number,
    showUnreadOnly: boolean,
  ) => Promise<PaginatedNotificationResponse>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationAsRead: () => Promise<void>;

  // Notification settings
  getNotificationSettings: () => Promise<BorrowerNotificationSettings>;
  updateNotificationSettings: (
    settings: BorrowerNotificationSettings,
  ) => Promise<BorrowerNotificationSettings>;

  // API Key methods
  getApiKeys: () => Promise<ApiKey[]>;
  createApiKey: (request: CreateApiKeyRequest) => Promise<CreateApiKeyResponse>;
  deleteApiKey: (id: number) => Promise<void>;
}

// Create a factory function to create our client
export const createHttpClient = (
  baseUrl: string,
  onAuthError?: () => void,
): HttpClient => {
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
            // note: the best practice would be to have a separate refresh token which is valid longer
            // than the normal token. If we ever get a 401, we should use the refresh token to refresh,
            // only if this refresh token fails, we redirect to /login
            onAuthError();
          }
        }
      }
      return Promise.reject(error);
    },
  );

  // Common error handler (kept the same as your class implementation)
  const handleError = (error: unknown, context: string) => {
    if (axios.isAxiosError(error) && error.response) {
      const message = error.response.data.message;
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
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const verifyEmail = async (token: string): Promise<string> => {
    try {
      const response = await axiosClient.get(`/api/auth/verifyemail/${token}`);
      return response.data.message;
    } catch (error) {
      handleError(error, "verifying email");
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getVersion = async (): Promise<Version> => {
    try {
      const response: AxiosResponse<Version> =
        await axiosClient.get("/api/version");
      return response.data;
    } catch (error) {
      handleError(error, "getting version");
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      throw error; // Satisfies the linter, though it won't actually be reached.
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
  const getDirectLoanOffers = async (): Promise<LoanOffer[]> => {
    try {
      const response = await axiosClient.get("/api/offers?loan_type=Direct");
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offers");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getDirectLoanOffersByLender = async (
    lenderId: string,
  ): Promise<LoanOffer[]> => {
    try {
      const response: AxiosResponse<LoanOffer[]> = await axiosClient.get(
        `/api/offers/by-lender/${lenderId}?loan_type=Direct`,
      );
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offer by lender");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };
  const getIndirectLoanOffersByLender = async (
    lenderId: string,
  ): Promise<LoanOffer[]> => {
    try {
      const response: AxiosResponse<LoanOffer[]> = await axiosClient.get(
        `/api/offers/by-lender/${lenderId}?loan_type=Indirect`,
      );
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offer by lender");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getLoanOffer = async (id: string): Promise<LoanOffer> => {
    try {
      const response: AxiosResponse<LoanOffer> = await axiosClient.get(
        `/api/offers/${id}`,
      );
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offer");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const postLoanApplication = async (
    request: PostLoanApplication,
  ): Promise<LoanRequest> => {
    try {
      const response: AxiosResponse<LoanRequest> = await axiosClient.post(
        "/api/loan-applications",
        request,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting loan application");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

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
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const editLoanApplication = async (
    id: string,
    loan_amount: number,
    duration_days: number,
    interest_rate: number,
    ltv: number,
  ): Promise<void> => {
    try {
      await axiosClient.put(`/api/loan-applications/edit/${id}`, {
        loan_amount: loan_amount,
        duration_days: duration_days,
        interest_rate: interest_rate,
        ltv: ltv,
      });
    } catch (error) {
      handleError(error, "editing loan application");
    }
  };

  const deleteLoanApplication = async (id: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/loan-applications/delete/${id}`);
    } catch (error) {
      handleError(error, "deleting loan application");
    }
  };

  const postExtendLoanRequest = async (
    contractId: string,
    request: ExtendPostLoanRequest,
  ): Promise<LoanRequest> => {
    try {
      const response: AxiosResponse<LoanRequest> = await axiosClient.post(
        `/api/contracts/${contractId}/extend`,
        request,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting loan extension request");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const postContractRequest = async (
    request: ContractRequest,
  ): Promise<Contract> => {
    console.log(`Request ${JSON.stringify(request)}`);
    try {
      const response: AxiosResponse<Contract> = await axiosClient.post(
        "/api/contracts",
        request,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting contract request");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const cancelContractRequest = async (contractId: string): Promise<void> => {
    try {
      await axiosClient.delete(`/api/contracts/${contractId}`);
    } catch (error) {
      handleError(error, "cancelling contract request");
    }
  };

  // Contract related methods
  const getContracts = async (
    pagination?: PaginationQuery,
  ): Promise<{
    data: Contract[];
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  }> => {
    try {
      let url = "/api/contracts";
      const params = new URLSearchParams();

      if (pagination?.page !== undefined) {
        params.append("page", pagination.page.toString());
      }
      if (pagination?.limit !== undefined) {
        params.append("limit", pagination.limit.toString());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      console.log("Making request to:", url);
      const response: AxiosResponse<PaginatedContractsResponse> =
        await axiosClient.get(url);
      console.log("Response data:", response.data);

      const contracts = response.data.data.map((contract: RawContract) => {
        const createdAt = parseRFC3339Date(contract.created_at);
        if (createdAt === undefined) {
          throw new Error("Missing created_at");
        }

        const updatedAt = parseRFC3339Date(contract.updated_at);
        if (updatedAt === undefined) {
          throw new Error("Missing updated_at");
        }

        const expiry = parseRFC3339Date(contract.expiry);
        if (expiry === undefined) {
          throw new Error("Missing expiry");
        }

        return {
          ...contract,
          created_at: createdAt,
          updated_at: updatedAt,
          expiry: expiry,
        };
      });

      return {
        data: contracts,
        page: response.data.page,
        limit: response.data.limit,
        total: response.data.total,
        total_pages: response.data.total_pages,
      };
    } catch (error) {
      handleError(error, "fetching contracts");
      throw error; // Satisfies the linter, though it won't actually be reached.
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

      // We'll check the dates that must exist
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
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const markInstallmentAsPaid = async (
    contractId: string,
    installmentId: string,
    paymentId: string,
  ): Promise<void> => {
    try {
      await axiosClient.put(`/api/contracts/${contractId}/installment-paid`, {
        installment_id: installmentId,
        payment_id: paymentId,
      });
    } catch (error) {
      handleError(error, "marking installment as paid");
    }
  };

  const getClaimCollateralPsbt = async (
    id: string,
    feeRate: number,
  ): Promise<ClaimCollateralPsbtResponse> => {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> =
        await axiosClient.get(`/api/contracts/${id}/claim?fee_rate=${feeRate}`);
      return res.data;
    } catch (error) {
      handleError(error, "claiming collateral psbt");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getClaimDisputeCollateralPsbt = async (
    disputeId: string,
    feeRate: number,
  ): Promise<ClaimCollateralPsbtResponse> => {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> =
        await axiosClient.get(
          `/api/disputes/${disputeId}/claim?fee_rate=${feeRate}`,
        );
      return res.data;
    } catch (error) {
      handleError(error, "claim dispute psbt");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const postClaimTx = async (
    contract_id: string,
    tx: string,
  ): Promise<string> => {
    try {
      const response: AxiosResponse<string> = await axiosClient.post(
        `/api/contracts/${contract_id}/broadcast-claim`,
        { tx: tx },
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting claim psbt");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const putFiatDetails = async (
    contractId: string,
    fiatDetails: FiatLoanDetails,
  ): Promise<void> => {
    try {
      await axiosClient.put(
        `/api/contracts/${contractId}/fiat-details`,
        fiatDetails,
      );
    } catch (error) {
      handleError(error, "providing fiat loan details");
    }
  };

  const updateBorrowerBtcAddress = async (
    contract_id: string,
    address: string,
    message: string,
    recoverableSignatureHex: string,
    recoverableSignatureId: number,
  ): Promise<void> => {
    try {
      await axiosClient.put(`/api/contracts/${contract_id}/borrower-address`, {
        address,
        message,
        recoverable_signature_hex: recoverableSignatureHex,
        recoverable_signature_id: recoverableSignatureId,
      });
    } catch (error) {
      handleError(error, "updating borrower btc address");
    }
  };

  const startDispute = async (
    contract_id: string,
    reason: string,
    comment: string,
  ): Promise<Dispute> => {
    try {
      const response: AxiosResponse<Dispute> = await axiosClient.post(
        `/api/disputes`,
        {
          contract_id,
          reason,
          comment,
        },
      );
      return response.data;
    } catch (error) {
      handleError(error, "starting dispute");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const resolveDispute = async (disputeId: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/disputes/${disputeId}/resolve`);
    } catch (error) {
      handleError(error, "resolve dispute");
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
      throw error; // Satisfies the linter, though it won't actually be reached.
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
      handleError(error, "comment on dispute");
    }
  };

  const getDispute = (_disputeId: string): Promise<Dispute> => {
    // TODO: this is not implemented, keeping the same as your original
    throw Error("Not implemented");
  };

  const getLenderProfile = async (id: string): Promise<LenderStats> => {
    try {
      const response: AxiosResponse<LenderStatsRaw> = await axiosClient.get(
        `/api/lenders/${id}`,
      );

      const joinedAt = parseRFC3339Date(response.data.joined_at);
      if (joinedAt == null) {
        throw new Error("Invalid date");
      }

      return { ...response.data, joined_at: joinedAt };
    } catch (error) {
      handleError(error, "getting lender profile");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getBorrowerProfile = async (id: string): Promise<BorrowerStats> => {
    try {
      const response: AxiosResponse<BorrowerStatsRaw> = await axiosClient.get(
        `/api/borrowers/${id}`,
      );

      const joinedAt = parseRFC3339Date(response.data.joined_at);
      if (joinedAt == null) {
        throw new Error("Invalid date");
      }

      return { ...response.data, joined_at: joinedAt };
    } catch (error) {
      handleError(error, "getting borrower profile");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getUserCards = async (): Promise<UserCardDetail[]> => {
    try {
      const response: AxiosResponse<UserCardDetail[]> =
        await axiosClient.get("/api/moon/cards");

      return response.data;
    } catch (error) {
      handleError(error, "getting user cards");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const getCardTransactions = async (
    cardId: string,
  ): Promise<CardTransaction[]> => {
    try {
      const transactionResponse: AxiosResponse<CardTransaction[]> =
        await axiosClient.get(`/api/moon/transactions/${cardId}`);
      return transactionResponse.data;
    } catch (error) {
      handleError(error, "getting card transactions");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const putUpdateProfile = async (request: PutUpdateProfile): Promise<void> => {
    try {
      await axiosClient.put("/api/users/", request);
    } catch (error) {
      handleError(error, "updating profile");
    }
  };

  const putUpdateLocale = async (localeString?: string): Promise<void> => {
    try {
      await axiosClient.put("/api/users/locale", { locale: localeString });
    } catch (error) {
      handleError(error, "updating locale");
    }
  };

  const newChatNotification = async (request: NotifyUser): Promise<void> => {
    try {
      await axiosClient.post("/api/chat/notification", request);
    } catch (error) {
      handleError(error, "posting new chat message");
    }
  };

  const postBringinConnect = async (
    bringinEmail: string,
  ): Promise<BringinConnectResponse> => {
    try {
      const res: AxiosResponse<BringinConnectResponse> = await axiosClient.post(
        "/api/bringin/connect",
        {
          bringin_email: bringinEmail,
        },
      );

      return res.data;
    } catch (error) {
      handleError(error, "connecting Lendasat to Bringin");
      throw error; // Satisfies the linter, though it won't actually be reached.
    }
  };

  const hasBringinApiKey = async (): Promise<boolean> => {
    try {
      const axiosResponse: AxiosResponse<HasApiKey> = await axiosClient.get(
        "/api/bringin/api-key",
      );
      return axiosResponse.data.has_key;
    } catch (error) {
      handleError(error, "checking if user has Bringin API key");
      throw error; // Satisfies the linter, though it won't actually be reached.
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
  const markNotificationAsRead = async (id: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/notifications/${id}`);
    } catch (error) {
      handleError(error, "marking notification as read");
      throw error;
    }
  };
  const markAllNotificationAsRead = async (): Promise<void> => {
    try {
      await axiosClient.put(`/api/notifications`);
    } catch (error) {
      handleError(error, "marking all notifications as read");
      throw error;
    }
  };

  // Notification settings
  const getNotificationSettings =
    async (): Promise<BorrowerNotificationSettings> => {
      try {
        const response: AxiosResponse<BorrowerNotificationSettings> =
          await axiosClient.get("/api/notification-settings");
        return response.data;
      } catch (error) {
        handleError(error, "fetching notification settings");
        throw error;
      }
    };

  const updateNotificationSettings = async (
    settings: BorrowerNotificationSettings,
  ): Promise<BorrowerNotificationSettings> => {
    try {
      const response: AxiosResponse<BorrowerNotificationSettings> =
        await axiosClient.put("/api/notification-settings", settings);
      return response.data;
    } catch (error) {
      handleError(error, "updating notification settings");
      throw error;
    }
  };

  // API Key methods
  const getApiKeys = async (): Promise<ApiKey[]> => {
    try {
      const response: AxiosResponse<ApiKey[]> =
        await axiosClient.get("/api/keys");

      // Defensive programming: ensure we always return an array
      if (!Array.isArray(response.data)) {
        console.warn("API returned non-array data, returning empty array");
        return [];
      }

      return response.data;
    } catch (error) {
      handleError(error, "fetching API keys");
      throw error;
    }
  };

  const createApiKey = async (
    request: CreateApiKeyRequest,
  ): Promise<CreateApiKeyResponse> => {
    try {
      const response: AxiosResponse<CreateApiKeyResponse> =
        await axiosClient.post("/api/keys", request);
      return response.data;
    } catch (error) {
      handleError(error, "creating API key");
      throw error;
    }
  };

  const deleteApiKey = async (id: number): Promise<void> => {
    try {
      await axiosClient.delete(`/api/keys/${id}`);
    } catch (error) {
      handleError(error, "deleting API key");
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
    resetPassword,
    getVersion,
    joinWaitlist,
    logout,
    me,
    check,
    refreshToken,
    getDirectLoanOffers,
    getDirectLoanOffersByLender,
    getIndirectLoanOffersByLender,
    getLoanOffer,
    postLoanApplication,
    getLoanApplications,
    editLoanApplication,
    deleteLoanApplication,
    updateBorrowerBtcAddress,
    postExtendLoanRequest,
    postContractRequest,
    cancelContractRequest,
    getContracts,
    getContract,
    markInstallmentAsPaid,
    getClaimCollateralPsbt,
    getClaimDisputeCollateralPsbt,
    postClaimTx,
    putFiatDetails,
    startDispute,
    getDispute,
    fetchDisputeWithMessages,
    resolveDispute,
    commentOnDispute,
    getLenderProfile,
    getBorrowerProfile,
    getUserCards,
    getCardTransactions,
    putUpdateProfile,
    putUpdateLocale,
    newChatNotification,
    getIsRegistered,
    postBringinConnect,
    hasBringinApiKey,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationAsRead,
    getNotificationSettings,
    updateNotificationSettings,
    getApiKeys,
    createApiKey,
    deleteApiKey,
  };
};

// Create the context
export const HttpClientContext = createContext<HttpClient | undefined>(
  undefined,
);

// Custom hook to use the API client
export const useHttpClientBorrower = () => {
  const context = useContext(HttpClientContext);
  if (context === undefined) {
    throw new Error(
      "useHttpClientBorrower must be used within a HttpClientProvider",
    );
  }
  return context;
};

// Provider component
interface HttpClientProviderProps {
  children: ReactNode;
  baseUrl: string;
}

export const HttpClientProvider: FC<HttpClientProviderProps> = ({
  children,
  baseUrl,
}) => {
  const client = useMemo(() => {
    return createHttpClient(baseUrl);
  }, [baseUrl]);

  return (
    <HttpClientContext.Provider value={client}>
      {children}
    </HttpClientContext.Provider>
  );
};
