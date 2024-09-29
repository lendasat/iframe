import axios, { AxiosInstance } from "axios";

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export class MempoolClient {
  private httpClient: AxiosInstance;

  constructor(baseUrl?: string) {
    let innserBaseUrl = "https://mempool.space";
    if (baseUrl !== undefined) {
      innserBaseUrl = baseUrl;
    }
    this.httpClient = axios.create({
      baseURL: innserBaseUrl,
    });
  }

  async getRecommendedFees(): Promise<RecommendedFees> {
    try {
      const response = await this.httpClient.get("/api/v1/fees/recommended");
      return response.data;
    } catch (error) {
      console.error("Failed to fetch recommended fees:", error);
      throw error;
    }
  }
}

export default MempoolClient;
