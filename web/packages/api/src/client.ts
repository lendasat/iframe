import type {
  MeResponse,
  PaginatedContractsResponse,
  ContractStatus,
  SortField,
  SortOrder,
  LoanOffer,
  LoanApplication,
  QueryParamLoanType,
  AssetTypeFilter,
  KycFilter,
  Contract,
} from "./types";
import {
  mapMeResponse,
  mapPaginatedContractsResponse,
  mapSortField,
  mapLoanOffer,
  mapLoanApplication,
  mapContract,
} from "./types";
import createClient, { Client } from "openapi-fetch";
import { paths } from "./openapi/schema";
import { v4 as uuidv4 } from "uuid";
import debug from "debug";

const log = debug("api:client");

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized: No API key provided") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ApiClient {
  private baseUrl: string;
  private client: Client<paths>;
  private api_key?: string;

  constructor(baseUrl: string = "/api", api_key?: string) {
    this.baseUrl = baseUrl;
    this.client = createClient<paths>({ baseUrl });
    this.api_key = api_key;
  }

  /**
   * Set the API key for authenticated requests
   * @param apiKey - The Lendasat API key
   */
  setApiKey(apiKey: string): void {
    this.api_key = apiKey;
  }

  // Applications API

  async register(
    email: string,
    username: string,
    api_key: string,
    referral_code: string,
  ): Promise<void> {
    const id = uuidv4();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const { data, error } = await this.client.POST(
      "/api/create-api-account/byok",
      {
        body: {
          api_key,
          email,
          name: username,
          timezone,
          referral_code,
        },
      },
    );
    if (error) {
      throw Error(error);
    }
    this.api_key = api_key;
    log("api key created:", { id: data.id });

    return;
  }
  async me(): Promise<MeResponse> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.GET("/api/users/me", {
      headers: { "x-api-key": this.api_key },
    });
    if (error) {
      throw Error(error);
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return mapMeResponse(data);
  }

  async contracts(params?: {
    page?: number;
    limit?: number;
    status?: ContractStatus[];
    sortBy?: SortField;
    sortOrder?: SortOrder;
  }): Promise<PaginatedContractsResponse> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.GET("/api/contracts", {
      headers: { "x-api-key": this.api_key },
      params: {
        query: {
          page: params?.page,
          limit: params?.limit,
          status: params?.status,
          sort_by: params?.sortBy ? mapSortField(params.sortBy) : undefined,
          sort_order: params?.sortOrder,
        },
      },
    });
    if (error) {
      throw Error(error);
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return mapPaginatedContractsResponse(data);
  }

  async offers(params?: {
    loanType?: QueryParamLoanType;
    assetType?: AssetTypeFilter;
    loanAssets?: string;
    kyc?: KycFilter;
    minLoanAmount?: number;
    maxLoanAmount?: number;
    maxInterestRate?: number;
    durationMin?: number;
    durationMax?: number;
  }): Promise<LoanOffer[]> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.GET("/api/offers", {
      headers: { "x-api-key": this.api_key },
      params: {
        query: {
          loan_type: params?.loanType,
          asset_type: params?.assetType,
          loan_assets: params?.loanAssets,
          kyc: params?.kyc,
          min_loan_amount: params?.minLoanAmount,
          max_loan_amount: params?.maxLoanAmount,
          max_interest_rate: params?.maxInterestRate,
          duration_min: params?.durationMin,
          duration_max: params?.durationMax,
        },
      },
    });
    if (error) {
      throw Error(error);
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return data.map(mapLoanOffer);
  }

  async myApplications(): Promise<LoanApplication[]> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.GET("/api/loan-applications", {
      headers: { "x-api-key": this.api_key },
    });
    if (error) {
      throw Error(error);
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return data.map(mapLoanApplication);
  }

  /**
   * Request a new loan contract from a lender
   *
   * This method creates a contract request that will be forwarded to the lender.
   * The borrower provides their Bitcoin address and public key, specifies the loan
   * amount and duration, and references an existing loan offer.
   *
   * @param params - Contract request parameters
   * @param params.borrowerBtcAddress - The Bitcoin address where the borrower will receive collateral back.
   *                                     This should be a valid Bitcoin address (P2WPKH, P2PKH, etc.)
   * @param params.borrowerDerivationPath - The BIP32 derivation path used to generate the borrower's PR.
   *                                         Example: "m/84'/0'/0'/0/0" for first address of first account (BIP84/native segwit)
   *                                         It's for you to remember what key you used.
   * @param params.borrowerPk - The borrower's public key in hex format (compressed, 33 bytes = 66 hex chars).
   *                            This will be used to construct the mulitisig escrow account
   * @param params.durationDays - The desired loan duration in days. Must be within the lender's min/max duration range.
   * @param params.loanAmount - The loan amount in the loan's asset (e.g., USD for stablecoin loans).
   *                            Must be within the lender's min/max loan amount range.
   * @param params.offerId - The UUID of the loan offer being requested.
   * @param params.borrowerLoanAddress - Optional. The address where the borrower wants to receive the loan funds.
   *                                     For certain integrations (e.g., Pay with Moon), this is defined by the integration.
   *                                     For stablecoin loans, this would be an Ethereum/Polygon/etc. address.
   * @param params.borrowerNpub - Optional. The borrower's Nostr public key (npub format) for Nostr-based notifications.
   * @param params.clientContractId - Optional. A client-generated UUID to track this contract in your own system.
   *                                  Useful for reconciliation and preventing duplicate requests.
   *
   * @returns A Promise that resolves to the created Contract with status "Requested"
   *
   * @throws {UnauthorizedError} If no API key is provided
   * @throws {Error} If the API returns an error or no data
   *
   * @example
   * ```typescript
   * // Request a 30-day loan for 1000 USDC
   * const contract = await apiClient.requestContract({
   *   borrowerBtcAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
   *   borrowerDerivationPath: 'm/84\'/0\'/0\'/0/0',
   *   borrowerPk: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
   *   durationDays: 30,
   *   loanAmount: 1000,
   *   offerId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
   *   borrowerLoanAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', // Ethereum address for USDC
   * });
   *
   * console.log('Contract created:', contract.id);
   * console.log('Status:', contract.status); // "Requested"
   * ```
   *
   * @remarks
   * - The loan_type is hardcoded to "StableCoin" for now
   * - After the contract is created with status "Requested", the lender must approve it
   * - Once approved, the borrower must deposit Bitcoin collateral to the contract address
   * - The contract includes details about collateral requirements, interest, and repayment terms
   */
  async requestContract(params: {
    borrowerBtcAddress: string;
    borrowerDerivationPath: string;
    borrowerPk: string;
    durationDays: number;
    loanAmount: number;
    offerId: string;
    borrowerLoanAddress?: string | null;
    borrowerNpub?: string | null;
    clientContractId?: string | null;
  }): Promise<Contract> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.POST("/api/contracts", {
      headers: { "x-api-key": this.api_key },
      body: {
        borrower_btc_address: params.borrowerBtcAddress,
        borrower_derivation_path: params.borrowerDerivationPath,
        borrower_pk: params.borrowerPk,
        duration_days: params.durationDays,
        id: params.offerId,
        loan_amount: params.loanAmount,
        loan_type: "StableCoin",
        borrower_loan_address: params.borrowerLoanAddress,
        borrower_npub: params.borrowerNpub,
        client_contract_id: params.clientContractId,
      },
    });

    if (error) {
      throw Error(JSON.stringify(error));
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return mapContract(data);
  }

  async contractDetails(id: string): Promise<Contract> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.GET("/api/contracts/{id}", {
      headers: { "x-api-key": this.api_key },
      params: {
        path: {
          id,
        },
      },
    });

    if (error) {
      throw Error(JSON.stringify(error));
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return mapContract(data);
  }

  /**
   * Cancel a contract request
   *
   * This method cancels a contract that is in "Requested" status.
   * Only contracts that haven't been approved by the lender can be cancelled.
   *
   * @param id - The UUID of the contract to cancel
   * @returns A Promise that resolves when the contract is cancelled
   *
   * @throws {UnauthorizedError} If no API key is provided
   * @throws {Error} If the API returns an error
   *
   * @example
   * ```typescript
   * await apiClient.cancelContract('f47ac10b-58cc-4372-a567-0e02b2c3d479');
   * ```
   */
  async cancelContract(id: string): Promise<void> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { error } = await this.client.DELETE("/api/contracts/{id}", {
      headers: { "x-api-key": this.api_key },
      params: {
        path: {
          id,
        },
      },
    });

    if (error) {
      throw Error(JSON.stringify(error));
    }
  }

  /**
   * Mark a contract installment as repaid
   *
   * This method notifies the platform that a loan repayment has been made by providing
   * the transaction ID. The lender will verify the transaction on the blockchain and
   * update the contract status accordingly.
   *
   * @param id - The UUID of the contract being repaid
   * @param txid - The transaction ID (txid) of the repayment transaction on the blockchain.
   *               For Bitcoin: This is the Bitcoin transaction ID
   *               For stablecoins: This is the transaction hash on the respective chain (Ethereum, Polygon, etc.)
   * @param installment_id - The UUID of the specific installment being paid.
   *                         For bullet repayment (full repayment at end), this is typically a single installment.
   *                         For installment-based loans, this identifies which payment is being made.
   * @returns A Promise that resolves when the repayment is recorded
   *
   * @throws {UnauthorizedError} If no API key is provided
   * @throws {Error} If the API returns an error (e.g., invalid txid, installment already paid)
   *
   * @example
   * ```typescript
   * // Mark a contract as repaid after sending payment
   * await apiClient.repaidContract(
   *   'f47ac10b-58cc-4372-a567-0e02b2c3d479',  // contract ID
   *   'a1b2c3d4e5f6...', // transaction ID from blockchain
   *   'installment-uuid-here' // installment ID
   * );
   * ```
   *
   * @remarks
   * - The transaction must be broadcast to the blockchain before calling this method
   * - The lender will verify the transaction amount matches the expected installment amount
   * - Once verified and confirmed, the contract status will update (e.g., to "RepaymentProvided" or "RepaymentConfirmed")
   */
  async repaidContract(
    id: string,
    txid: string,
    installment_id: string,
  ): Promise<void> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { error } = await this.client.PUT(
      "/api/contracts/{id}/installment-paid",
      {
        headers: { "x-api-key": this.api_key },
        params: {
          path: {
            id,
          },
        },
        body: {
          installment_id,
          payment_id: txid,
        },
      },
    );

    if (error) {
      throw Error(JSON.stringify(error));
    }
  }

  /**
   * Get a PSBT (Partially Signed Bitcoin Transaction) to claim collateral from a contract
   *
   * This method creates a PSBT that spends the collateral from the contract address back to
   * the borrower's Bitcoin address. After the loan is fully repaid and confirmed, the borrower
   * can use this to reclaim their Bitcoin collateral from the multisig contract.
   *
   * The returned PSBT is a 2-of-3 multisig transaction that has already been signed by the
   * lender. The borrower needs to add their signature to complete the transaction.
   *
   * @param contractId - The UUID of the contract to claim collateral from
   * @param fee_rate - The fee rate in satoshis per vbyte (e.g., 10 for 10 sats/vbyte)
   * @returns A Promise that resolves to an object containing:
   *   - psbt: The partially signed transaction (already signed by lender)
   *   - collateral_descriptor: The descriptor for the collateral script
   *   - borrower_pk: The borrower's public key
   *
   * @throws {UnauthorizedError} If no API key is provided
   * @throws {Error} If the API returns an error (e.g., contract not in correct status, invalid fee rate)
   *
   * @example
   * ```typescript
   * // Get a PSBT with a fee rate of 10 sats/vbyte
   * const { psbt, collateral_descriptor, borrower_pk } = await apiClient.getClaimPsbt(
   *   'f47ac10b-58cc-4372-a567-0e02b2c3d479',
   *   10
   * );
   * console.log('PSBT:', psbt); // Hex-encoded PSBT with lender's signature
   * console.log('Descriptor:', collateral_descriptor); // Collateral script descriptor
   * console.log('Borrower PK:', borrower_pk); // Borrower's public key
   * ```
   *
   * @remarks
   * - The contract must be in "RepaymentConfirmed" status to claim collateral
   * - The PSBT is a 2-of-3 multisig and already contains the lender's signature
   * - The borrower must sign with their private key to add the second signature
   * - After signing, use `broadcastClaimPsbt()` to broadcast the transaction
   * - The fee rate affects how quickly the transaction will be confirmed
   */
  async getClaimPsbt(
    contractId: string,
    fee_rate: number,
  ): Promise<{
    psbt: string;
    collateral_descriptor: string;
    borrower_pk: string;
  }> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.GET("/api/contracts/{id}/claim", {
      headers: { "x-api-key": this.api_key },
      params: {
        path: {
          id: contractId,
        },
        query: {
          fee_rate,
        },
      },
    });

    if (error) {
      throw Error(JSON.stringify(error));
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return {
      psbt: data.psbt,
      collateral_descriptor: data.collateral_descriptor,
      borrower_pk: data.borrower_pk,
    };
  }

  /**
   * Broadcast a signed PSBT to claim collateral from a contract
   *
   * After obtaining a PSBT from `getClaimPsbt()` and signing it with the borrower's
   * private key, this method broadcasts the signed transaction to the Bitcoin network
   * to claim the collateral.
   *
   * @param contractId - The UUID of the contract being claimed
   * @param signedTx - The signed transaction in hex format (fully signed PSBT extracted as raw transaction)
   * @returns A Promise that resolves to an object containing the transaction ID
   *
   * @throws {UnauthorizedError} If no API key is provided
   * @throws {Error} If the API returns an error (e.g., invalid signature, transaction already broadcast)
   *
   * @example
   * ```typescript
   * // After signing the PSBT
   * const { txid } = await apiClient.broadcastClaimPsbt(
   *   'f47ac10b-58cc-4372-a567-0e02b2c3d479',
   *   'signed_transaction_hex...'
   * );
   * console.log('Transaction broadcast:', txid);
   * ```
   *
   * @remarks
   * - The transaction must be fully signed before broadcasting
   * - Once broadcast, the transaction cannot be reversed
   * - The collateral will be sent to the borrower's Bitcoin address specified in the contract
   * - You can monitor the transaction status on the blockchain using the returned txid
   */
  async broadcastClaimPsbt(
    contractId: string,
    signedTx: string,
  ): Promise<{ txid: string }> {
    if (!this.api_key) {
      throw new UnauthorizedError();
    }

    const { data, error } = await this.client.POST(
      "/api/contracts/{id}/broadcast-claim",
      {
        headers: { "x-api-key": this.api_key },
        params: {
          path: {
            id: contractId,
          },
        },
        body: {
          tx: signedTx,
        },
      },
    );

    if (error) {
      throw Error(JSON.stringify(error));
    }

    if (!data) {
      throw Error("No data returned from API");
    }

    return { txid: data };
  }
}

// Export a default instance without API key
// API key should be set via setApiKey() method after retrieving from wallet bridge
export const apiClient = new ApiClient("http://localhost:7337");
