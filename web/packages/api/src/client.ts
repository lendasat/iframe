import type {
  MeResponse,
  PaginatedContractsResponse,
  ContractStatus,
  SortField,
  SortOrder,
} from "./types";
import {
  mapMeResponse,
  mapPaginatedContractsResponse,
  mapSortField,
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
}

// Export a default instance
export const apiClient = new ApiClient(
  "http://localhost:7337",
  // TODO: do not hardcode this
  "lndst_sk_dee619e34a7e_NI2TUiMmYF9TcBavaFhUW0rZ63QOIsoldG1w0YdFMpR",
);
