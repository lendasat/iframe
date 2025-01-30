interface ImportMetaEnv {
  readonly VITE_BORROWER_BASE_URL: string;
  readonly VITE_LENDER_BASE_URL: string;
  readonly VITE_BITCOIN_NETWORK: string;
  readonly VITE_MEMPOOL_REST_URL: string;
  readonly VITE_BORROWER_USERNAME: string;
  readonly VITE_BORROWER_PASSWORD: string;
  readonly VITE_LENDER_USERNAME: string;
  readonly VITE_LENDER_PASSWORD: string;
  readonly VITE_TELEGRAM_BOT_URL: string;
  readonly VITE_TELEGRAM_BOT_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
