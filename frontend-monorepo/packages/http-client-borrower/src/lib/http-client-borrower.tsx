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
} from "./models";
import { isAllowedPageWithoutLogin, parseRFC3339Date } from "./utils";
import { IsRegisteredResponse } from "@frontend/base-http-client";

// Keep all your existing interfaces as-is
interface RawContract
  extends Omit<Contract, "created_at" | "repaid_at" | "updated_at" | "expiry"> {
  created_at: string;
  updated_at: string;
  repaid_at?: string;
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
  ) => Promise<UpgradeToPakeResponse | undefined>;
  finishUpgradeToPake: (
    email: string,
    oldPassword: string,
    verifier: string,
    salt: string,
    newWalletBackupData: WalletBackupData,
  ) => Promise<void | undefined>;
  pakeLoginRequest: (
    email: string,
  ) => Promise<PakeLoginResponseOrUpgrade | undefined>;
  pakeVerifyRequest: (
    email: string,
    aPub: string,
    clientProof: string,
  ) => Promise<PakeVerifyResponse | undefined>;
  forgotPassword: (email: string) => Promise<string | undefined>;
  verifyEmail: (token: string) => Promise<string | undefined>;
  getIsRegistered: (email: string) => Promise<IsRegisteredResponse>;
  resetPassword: (
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    passwordResetToken: string,
  ) => Promise<string | undefined>;
  getVersion: () => Promise<Version | undefined>;
  joinWaitlist: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  me: () => Promise<MeResponse | undefined>;
  check: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Loan related methods
  getLoanOffers: () => Promise<LoanOffer[] | undefined>;
  getDirectLoanOffersByLender: (lenderId: string) => Promise<LoanOffer[] | undefined>;
  getIndirectLoanOffersByLender: (
    lenderId: string,
  ) => Promise<LoanOffer[] | undefined>;
  getLoanOffer: (id: string) => Promise<LoanOffer | undefined>;
  postLoanApplication: (
    request: PostLoanApplication,
  ) => Promise<LoanRequest | undefined>;
  getLoanApplications: () => Promise<LoanApplication[] | undefined>;
  postExtendLoanRequest: (
    contractId: string,
    request: ExtendPostLoanRequest,
  ) => Promise<LoanRequest | undefined>;
  postContractRequest: (
    request: ContractRequest,
  ) => Promise<Contract | undefined>;
  cancelContractRequest: (contractId: string) => Promise<void>;

  // Contract related methods
  getContracts: () => Promise<Contract[] | undefined>;
  getContract: (id: string) => Promise<Contract | undefined>;
  markAsRepaymentProvided: (id: string, txid: string) => Promise<void>;
  getClaimCollateralPsbt: (
    id: string,
    feeRate: number,
  ) => Promise<ClaimCollateralPsbtResponse | undefined>;
  getClaimDisputeCollateralPsbt: (
    disputeId: string,
    feeRate: number,
  ) => Promise<ClaimCollateralPsbtResponse | undefined>;
  postClaimTx: (contract_id: string, tx: string) => Promise<string | undefined>;

  // Dispute methods
  startDispute: (
    contract_id: string,
    reason: string,
    comment: string,
  ) => Promise<Dispute | undefined>;
  resolveDispute: (disputeId: string) => Promise<void>;
  fetchDisputeWithMessages: (
    contractId: string,
  ) => Promise<DisputeWithMessages[] | undefined>;
  commentOnDispute: (disputeId: string, message: string) => Promise<void>;
  getDispute: (disputeId: string) => Promise<Dispute>;

  // Profile methods
  getLenderProfile: (id: string) => Promise<LenderStats | undefined>;
  getBorrowerProfile: (id: string) => Promise<BorrowerStats | undefined>;

  // Card methods
  getUserCards: () => Promise<UserCardDetail[] | undefined>;
  getCardTransactions: (
    cardId: string,
  ) => Promise<CardTransaction[] | undefined>;
  putUpdateProfile: (request: PutUpdateProfile) => Promise<void>;
  newChatNotification: (request: NotifyUser) => Promise<void>;
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
  ): Promise<UpgradeToPakeResponse | undefined> => {
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
    }
  };

  const finishUpgradeToPake = async (
    email: string,
    oldPassword: string,
    verifier: string,
    salt: string,
    newWalletBackupData: WalletBackupData,
  ): Promise<void | undefined> => {
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
    }
  };

  const pakeLoginRequest = async (
    email: string,
  ): Promise<PakeLoginResponseOrUpgrade | undefined> => {
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
    }
  };

  const pakeVerifyRequest = async (
    email: string,
    aPub: string,
    clientProof: string,
  ): Promise<PakeVerifyResponse | undefined> => {
    try {
      const response = await axiosClient.post("/api/auth/pake-verify", {
        email,
        a_pub: aPub,
        client_proof: clientProof,
      });
      return response.data;
    } catch (error) {
      handleError(error, "PAKE verification");
    }
  };

  const forgotPassword = async (email: string): Promise<string | undefined> => {
    try {
      const response = await axiosClient.post("/api/auth/forgotpassword", {
        email: email,
      });
      return response.data.message;
    } catch (error) {
      handleError(error, "posting forget password");
    }
  };

  const verifyEmail = async (token: string): Promise<string | undefined> => {
    try {
      const response = await axiosClient.get(`/api/auth/verifyemail/${token}`);
      return response.data.message;
    } catch (error) {
      handleError(error, "verifying email");
    }
  };

  const resetPassword = async (
    verifier: string,
    salt: string,
    walletBackupData: WalletBackupData,
    passwordResetToken: string,
  ): Promise<string | undefined> => {
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
    }
  };

  const getVersion = async (): Promise<Version | undefined> => {
    try {
      const response: AxiosResponse<Version> =
        await axiosClient.get("/api/version");
      return response.data;
    } catch (error) {
      handleError(error, "getting version");
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

  const me = async (): Promise<MeResponse | undefined> => {
    try {
      const response = await axiosClient.get("/api/users/me");
      return response.data;
    } catch (error) {
      console.log(`error received`);
      handleError(error, "fetching user data");
    }
  };

  const check = async (): Promise<void> => {
    try {
      await axiosClient.get("/api/auth/check");
    } catch (error) {
      console.log;
      handleError(error, "auth check");
      throw error;
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
  const getLoanOffers = async (): Promise<LoanOffer[] | undefined> => {
    try {
      const response = await axiosClient.get("/api/loans/offer");
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offers");
    }
  };

  const getDirectLoanOffersByLender = async (
    lenderId: string,
  ): Promise<LoanOffer[] | undefined> => {
    try {
      const response: AxiosResponse<LoanOffer[]> = await axiosClient.get(
        `/api/loans/offer/bylender/${lenderId}?loan_type=Direct`,
      );
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offer by lender");
    }
  };
  const getIndirectLoanOffersByLender = async (
    lenderId: string,
  ): Promise<LoanOffer[] | undefined> => {
    try {
      const response: AxiosResponse<LoanOffer[]> = await axiosClient.get(
        `/api/loans/offer/bylender/${lenderId}?loan_type=Indirect`,
      );
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offer by lender");
    }
  };

  const getLoanOffer = async (id: string): Promise<LoanOffer | undefined> => {
    try {
      const response: AxiosResponse<LoanOffer> = await axiosClient.get(
        `/api/loans/offer/${id}`,
      );
      return response.data;
    } catch (error) {
      handleError(error, "fetching loan offer");
    }
  };

  const postLoanApplication = async (
    request: PostLoanApplication,
  ): Promise<LoanRequest | undefined> => {
    try {
      const response: AxiosResponse<LoanRequest> = await axiosClient.post(
        "/api/loans/application",
        request,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting loan application");
    }
  };

  const getLoanApplications = async (): Promise<
    LoanApplication[] | undefined
  > => {
    try {
      const response: AxiosResponse<RawLoanApplication[]> =
        await axiosClient.get("/api/loans/application");

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
    }
  };

  const postExtendLoanRequest = async (
    contractId: string,
    request: ExtendPostLoanRequest,
  ): Promise<LoanRequest | undefined> => {
    try {
      const response: AxiosResponse<LoanRequest> = await axiosClient.post(
        `/api/contracts/${contractId}/extend`,
        request,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting loan extension request");
    }
  };

  const postContractRequest = async (
    request: ContractRequest,
  ): Promise<Contract | undefined> => {
    console.log(`Request ${JSON.stringify(request)}`);
    try {
      const response: AxiosResponse<Contract> = await axiosClient.post(
        "/api/contracts",
        request,
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting contract request");
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
  const getContracts = async (): Promise<Contract[] | undefined> => {
    try {
      const response: AxiosResponse<RawContract[]> =
        await axiosClient.get("/api/contracts");
      return response.data.map((contract: any) => ({
        ...contract,
        created_at: parseRFC3339Date(contract.created_at),
        updated_at: parseRFC3339Date(contract.updated_at),
        repaid_at: contract.repaid_at
          ? parseRFC3339Date(contract.repaid_at)
          : undefined,
        expiry: parseRFC3339Date(contract.expiry),
      }));
    } catch (error) {
      handleError(error, "fetching contracts");
    }
  };

  const getContract = async (id: string): Promise<Contract | undefined> => {
    try {
      const contractResponse: AxiosResponse<RawContract> =
        await axiosClient.get(`/api/contracts/${id}`);
      const contract = contractResponse.data;

      const createdAt = parseRFC3339Date(contract.created_at);
      const updatedAt = parseRFC3339Date(contract.updated_at);
      const repaidAt = contract.repaid_at
        ? parseRFC3339Date(contract.repaid_at)
        : undefined;
      const expiry = parseRFC3339Date(contract.expiry);

      // We'll check the dates that must exist
      if (createdAt === null || updatedAt === null || expiry === null) {
        throw new Error("Invalid date");
      }

      return {
        ...contract,
        created_at: createdAt!,
        updated_at: updatedAt!,
        repaid_at: repaidAt,
        expiry: expiry!,
      };
    } catch (error) {
      handleError(error, "fetching contract");
    }
  };

  const markAsRepaymentProvided = async (
    id: string,
    txid: string,
  ): Promise<void> => {
    try {
      await axiosClient.put(`/api/contracts/${id}/repaid?txid=${txid}`);
    } catch (error) {
      handleError(error, "marking contract as repaid");
    }
  };

  const getClaimCollateralPsbt = async (
    id: string,
    feeRate: number,
  ): Promise<ClaimCollateralPsbtResponse | undefined> => {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> =
        await axiosClient.get(`/api/contracts/${id}/claim?fee_rate=${feeRate}`);
      return res.data;
    } catch (error) {
      handleError(error, "claiming collateral psbt");
    }
  };

  const getClaimDisputeCollateralPsbt = async (
    disputeId: string,
    feeRate: number,
  ): Promise<ClaimCollateralPsbtResponse | undefined> => {
    try {
      const res: AxiosResponse<ClaimCollateralPsbtResponse> =
        await axiosClient.get(
          `/api/disputes/${disputeId}/claim?fee_rate=${feeRate}`,
        );
      return res.data;
    } catch (error) {
      handleError(error, "claim dispute psbt");
    }
  };

  const postClaimTx = async (
    contract_id: string,
    tx: string,
  ): Promise<string | undefined> => {
    try {
      const response: AxiosResponse<string> = await axiosClient.post(
        `/api/contracts/${contract_id}`,
        { tx: tx },
      );
      return response.data;
    } catch (error) {
      handleError(error, "posting claim psbt");
    }
  };

  const startDispute = async (
    contract_id: string,
    reason: string,
    comment: string,
  ): Promise<Dispute | undefined> => {
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
  ): Promise<DisputeWithMessages[] | undefined> => {
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

  const getLenderProfile = async (
    id: string,
  ): Promise<LenderStats | undefined> => {
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
    }
  };

  const getBorrowerProfile = async (
    id: string,
  ): Promise<BorrowerStats | undefined> => {
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
    }
  };

  const getUserCards = async (): Promise<UserCardDetail[] | undefined> => {
    try {
      const response: AxiosResponse<UserCardDetail[]> =
        await axiosClient.get("/api/cards");

      return response.data;
    } catch (error) {
      handleError(error, "getting user cards");
    }
  };

  const getCardTransactions = async (
    cardId: string,
  ): Promise<CardTransaction[] | undefined> => {
    try {
      const transactionResponse: AxiosResponse<CardTransaction[]> =
        await axiosClient.get(`/api/transaction/${cardId}`);
      return transactionResponse.data;
    } catch (error) {
      handleError(error, "getting card transactions");
    }
  };

  const putUpdateProfile = async (request: PutUpdateProfile): Promise<void> => {
    try {
      await axiosClient.put("/api/users/", request);
    } catch (error) {
      handleError(error, "updating profile");
    }
  };

  const newChatNotification = async (request: NotifyUser): Promise<void> => {
    try {
      await axiosClient.post("/api/chat/notification", request);
    } catch (error) {
      handleError(error, "posting new chat message");
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
    getLoanOffers,
    getDirectLoanOffersByLender,
    getIndirectLoanOffersByLender,
    getLoanOffer,
    postLoanApplication,
    getLoanApplications,
    postExtendLoanRequest,
    postContractRequest,
    cancelContractRequest,
    getContracts,
    getContract,
    markAsRepaymentProvided,
    getClaimCollateralPsbt,
    getClaimDisputeCollateralPsbt,
    postClaimTx,
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
    newChatNotification,
    getIsRegistered,
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
