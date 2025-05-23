export enum TransactionType {
  Funding = "Funding",
  Dispute = "Dispute",
  PrincipalGiven = "PrincipalGiven",
  InstallmentPaid = "InstallmentPaid",
  Liquidation = "Liquidation",
  ClaimCollateral = "ClaimCollateral",
}

export interface LoanTransaction {
  txid: string;
  contract_id: string;
  transaction_type: TransactionType;
  timestamp: Date;
}

export enum LoanAsset {
  USDT_SN = "UsdtStrk",
  USDC_SN = "UsdcStrk",
  USDT_POL = "UsdtPol",
  USDC_POL = "UsdcPol",
  USDT_ETH = "UsdtEth",
  USDC_ETH = "UsdcEth",
  USDC_SOL = "UsdcSol",
  USDT_SOL = "UsdtSol",
  USDT_Liquid = "UsdtLiquid",
  USD = "Usd",
  EUR = "Eur",
  CHF = "Chf",
  MXN = "Mxn",
}

export enum LoanPayout {
  Direct = "Direct",
  Indirect = "Indirect",
}

export function parseLoanAsset(value: string): LoanAsset {
  if (Object.values(LoanAsset).includes(value as LoanAsset)) {
    return value as LoanAsset;
  }
  throw Error("Loan asset not supported");
}

export class LoanAssetHelper {
  static print(coin: LoanAsset): string {
    switch (coin) {
      case LoanAsset.USDT_SN:
        return "USDT Starknet";
      case LoanAsset.USDC_SN:
        return "USDC Starknet";
      case LoanAsset.USDT_POL:
        return "USDT Polygon";
      case LoanAsset.USDC_POL:
        return "USDC Polygon";
      case LoanAsset.USDT_ETH:
        return "USDT Ethereum";
      case LoanAsset.USDC_ETH:
        return "USDC Ethereum";
      case LoanAsset.USDC_SOL:
        return "USDC Solana";
      case LoanAsset.USDT_SOL:
        return "USDT Solana";
      case LoanAsset.USDT_Liquid:
        return "USDT Liquid";
      case LoanAsset.USD:
        return "USD";
      case LoanAsset.EUR:
        return "EUR";
      case LoanAsset.CHF:
        return "CHF";
      case LoanAsset.MXN:
        return "MXN";
    }
  }

  static all(): LoanAsset[] {
    return [
      LoanAsset.USDT_SN,
      LoanAsset.USDC_SN,
      LoanAsset.USDT_ETH,
      LoanAsset.USDC_ETH,
      LoanAsset.USDT_POL,
      LoanAsset.USDC_POL,
      LoanAsset.USDT_SOL,
      LoanAsset.USDC_SOL,
      LoanAsset.USDT_Liquid,
      LoanAsset.USD,
      LoanAsset.EUR,
      LoanAsset.CHF,
      LoanAsset.MXN,
    ];
  }

  static allStableCoins(): LoanAsset[] {
    return [
      LoanAsset.USDT_SN,
      LoanAsset.USDC_SN,
      LoanAsset.USDT_ETH,
      LoanAsset.USDC_ETH,
      LoanAsset.USDT_POL,
      LoanAsset.USDC_POL,
      LoanAsset.USDT_SOL,
      LoanAsset.USDC_SOL,
      LoanAsset.USDT_Liquid,
    ];
  }

  static allFiatCoins(): LoanAsset[] {
    return [LoanAsset.USD, LoanAsset.EUR, LoanAsset.CHF, LoanAsset.MXN];
  }

  static toChain(loanAsset: LoanAsset) {
    switch (loanAsset) {
      case LoanAsset.USDC_SN:
      case LoanAsset.USDT_SN:
        return "Starknet";
      case LoanAsset.USDC_POL:
      case LoanAsset.USDT_POL:
        return "Polygon";
      case LoanAsset.USDC_ETH:
      case LoanAsset.USDT_ETH:
        return "Ethereum";
      case LoanAsset.USDT_SOL:
      case LoanAsset.USDC_SOL:
        return "Solana";
      case LoanAsset.USDT_Liquid:
        return "Liquid";
      case LoanAsset.EUR:
      case LoanAsset.USD:
      case LoanAsset.CHF:
      case LoanAsset.MXN:
        // Fiat runs on the fiat chain 😅
        return "Fiat";
    }
  }

  static toCoin(loanAsset: LoanAsset) {
    switch (loanAsset) {
      case LoanAsset.USDC_SN:
      case LoanAsset.USDC_POL:
      case LoanAsset.USDC_ETH:
      case LoanAsset.USDC_SOL:
        return "USDC";
      case LoanAsset.USDT_SN:
      case LoanAsset.USDT_POL:
      case LoanAsset.USDT_ETH:
      case LoanAsset.USDT_SOL:
      case LoanAsset.USDT_Liquid:
        return "USDT";
      case LoanAsset.USD:
        return "USD";
      case LoanAsset.EUR:
        return "EUR";
      case LoanAsset.CHF:
        return "CHF";
      case LoanAsset.MXN:
        return "MXN";
    }
  }

  static isStableCoin(loanAsset: LoanAsset) {
    switch (loanAsset) {
      case LoanAsset.USDC_SN:
      case LoanAsset.USDC_POL:
      case LoanAsset.USDC_ETH:
      case LoanAsset.USDC_SOL:
      case LoanAsset.USDT_SN:
      case LoanAsset.USDT_POL:
      case LoanAsset.USDT_ETH:
      case LoanAsset.USDT_SOL:
      case LoanAsset.USDT_Liquid:
        return true;
      case LoanAsset.USD:
      case LoanAsset.EUR:
      case LoanAsset.CHF:
      case LoanAsset.MXN:
        return false;
    }
  }

  static isFiat(loanAsset: LoanAsset) {
    switch (loanAsset) {
      case LoanAsset.USDC_SN:
      case LoanAsset.USDC_POL:
      case LoanAsset.USDC_ETH:
      case LoanAsset.USDC_SOL:
      case LoanAsset.USDT_SN:
      case LoanAsset.USDT_POL:
      case LoanAsset.USDT_ETH:
      case LoanAsset.USDT_SOL:
      case LoanAsset.USDT_Liquid:
        return false;
      case LoanAsset.USD:
      case LoanAsset.EUR:
      case LoanAsset.CHF:
      case LoanAsset.MXN:
        return true;
    }
  }

  static toContractUrl(loanAsset: LoanAsset) {
    switch (loanAsset) {
      case LoanAsset.USDC_SN:
        return "https://starkscan.co/token/0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
      case LoanAsset.USDT_SN:
        return "https://starkscan.co/token/0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8";
      case LoanAsset.USDC_POL:
        return "https://polygonscan.com/token/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
      case LoanAsset.USDT_POL:
        return "https://polygonscan.com/token/0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
      case LoanAsset.USDC_ETH:
        return "https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
      case LoanAsset.USDT_ETH:
        return "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7";
      case LoanAsset.USDC_SOL:
        return "https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      case LoanAsset.USDT_SOL:
        return "https://solscan.io/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
      case LoanAsset.USDT_Liquid: // TODO: it should exist somewhere but I couldn't find it
      case LoanAsset.CHF:
      case LoanAsset.EUR:
      case LoanAsset.USD:
      case LoanAsset.MXN:
        // Fiat coins do not have a contract URL
        return "";
    }
  }
}

export type OldPassword = { type: "oldPassword"; value: string };
export type Mnemonic = { type: "mnemonic"; value: string };

export type OldPasswordOrMnemonic = OldPassword | Mnemonic;
