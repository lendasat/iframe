{
  config,
  lib,
  pkgs,
  ...
}:
with lib; let
  cfg = config.services.lendasat;

  # Create environment variables for all non-null settings
  envVars = filterAttrs (n: v: v != null) {
    DB_URL = cfg.settings.databaseUrl;
    NETWORK = cfg.settings.network;
    USE_FAKE_PRICE =
      if cfg.settings.useFakePrice
      then "true"
      else "false";
    CUSTOM_DB_MIGRATION =
      if cfg.settings.customDbMigration
      then "true"
      else "false";
    SEED_FILE = cfg.settings.seedFile;
    FALLBACK_XPUB = cfg.settings.fallbackXpub;
    JWT_SECRET = cfg.settings.jwtSecret;
    SMTP_HOST = cfg.settings.smtp.host;
    SMTP_PORT =
      if cfg.settings.smtp.port != null
      then toString cfg.settings.smtp.port
      else null;
    SMTP_USER = cfg.settings.smtp.user;
    SMTP_PASS = cfg.settings.smtp.pass;
    SMTP_FROM = cfg.settings.smtp.from;
    SMTP_DISABLED =
      if cfg.settings.smtp.disabled
      then "true"
      else "false";
    BORROWER_LISTEN_ADDRESS = cfg.settings.borrowerListenAddress;
    BORROWER_FRONTEND_ORIGIN = cfg.settings.borrowerFrontendOrigin;
    LENDER_LISTEN_ADDRESS = cfg.settings.lenderListenAddress;
    LENDER_FRONTEND_ORIGIN = cfg.settings.lenderFrontendOrigin;
    HUB_FEE_DESCRIPTOR = cfg.settings.hubFeeDescriptor;
    HUB_FEE_WALLET_DIR = cfg.settings.hubFeeWalletDir;
    HUB_ORIGINATION_FEE = cfg.settings.hubOriginationFee;
    HUB_EXTENSION_ORIGINATION_FEE = cfg.settings.hubExtensionOriginationFee;
    MOON_API_KEY = cfg.settings.moon.apiKey;
    MOON_API_URL = cfg.settings.moon.apiUrl;
    MOON_WEBHOOK_URL = cfg.settings.moon.webhookUrl;
    MOON_VISA_PRODUCT_ID = cfg.settings.moon.visaProductId;
    MOON_SYNC_TX =
      if cfg.settings.moon.syncTx
      then "true"
      else "false";
    MOON_CARD_TOPUP_FEE = cfg.settings.moon.cardTopupFee;
    SIDESHIFT_SECRET = cfg.settings.sideshift.secret;
    SIDESHIFT_AFFILIATE_ID = cfg.settings.sideshift.affiliateId;
    SIDESHIFT_API_BASE_URL = cfg.settings.sideshift.apiBaseUrl;
    SIDESHIFT_COMMISSION_RATE =
      if cfg.settings.sideshift.commissionRate != null
      then toString cfg.settings.sideshift.commissionRate
      else null;
    FAKE_CLIENT_IP = cfg.settings.fakeClientIp;
    TELEGRAM_TOKEN = cfg.settings.telegramBotToken;
    BRINGIN_URL = cfg.settings.bringin.url;
    BRINGIN_API_SECRET = cfg.settings.bringin.apiSecret;
    BRINGIN_API_KEY = cfg.settings.bringin.apiKey;
    BRINGIN_WEBHOOK_URL = cfg.settings.bringin.webhookUrl;
    ETHERSCAN_API_KEY = cfg.settings.etherscanApiKey;
    FALLBACK_NPUB = cfg.settings.fallbackNpub;
    ESPLORA_URLS = cfg.settings.esplora_urls;
    BTSIEVE_SYNC_INTERVAL = cfg.settings.btsieve_sync_interval;
    ESPLORA_RESET_TX = cfg.settings.esplora_reset_tx;
  };
in {
  options.services.lendasat = {
    enable = mkEnableOption "Lendasat Hub service";

    package = mkOption {
      type = types.package;
      description = "The Lendasat hub package to use";
      # Note: default will be set by the flake module wrapper
    };

    settings = {
      # Required settings
      databaseUrl = mkOption {
        type = types.str;
        description = "PostgreSQL database URL";
        example = "postgres://user:pass@localhost:5432/hub";
      };

      mempoolRestUrl = mkOption {
        type = types.str;
        description = "Mempool REST API URL";
        example = "https://mempool.space/api";
      };

      mempoolWsUrl = mkOption {
        type = types.str;
        description = "Mempool WebSocket URL";
        example = "wss://mempool.space/api/v1/ws";
      };

      network = mkOption {
        type = types.enum ["mainnet" "testnet" "signet" "regtest"];
        default = null;
        description = "Bitcoin network to use";
      };

      seedFile = mkOption {
        type = types.str;
        description = "Path to wallet seed file";
        example = "/var/lib/lendasat/seed";
      };

      fallbackXpub = mkOption {
        type = types.str;
        description = "Fallback extended public key";
      };

      jwtSecret = mkOption {
        type = types.str;
        description = "JWT secret for authentication";
      };

      borrowerListenAddress = mkOption {
        type = types.str;
        default = "127.0.0.1:7337";
        description = "Borrower API listen address";
      };

      borrowerFrontendOrigin = mkOption {
        type = types.str;
        description = "Borrower frontend origin URL";
        example = "https://borrow.example.com";
      };

      lenderListenAddress = mkOption {
        type = types.str;
        default = "127.0.0.1:7338";
        description = "Lender API listen address";
      };

      lenderFrontendOrigin = mkOption {
        type = types.str;
        description = "Lender frontend origin URL";
        example = "https://lend.example.com";
      };

      hubFeeDescriptor = mkOption {
        type = types.str;
        description = "Hub fee descriptor for Bitcoin transactions";
      };

      hubOriginationFee = mkOption {
        type = types.str;
        description = "Hub origination fee in format 'start,end,fee'";
        example = "0,100,1.5";
      };

      hubExtensionOriginationFee = mkOption {
        type = types.str;
        description = "Hub extension origination fee in format 'start,end,fee'";
        example = "0,100,1";
      };

      fallbackNpub = mkOption {
        type = types.str;
        description = "Fallback Nostr public key";
      };

      # Required API settings
      moon = {
        apiKey = mkOption {
          type = types.str;
          description = "Moon API key";
        };

        apiUrl = mkOption {
          type = types.str;
          description = "Moon API URL";
        };

        webhookUrl = mkOption {
          type = types.str;
          description = "Moon webhook URL";
        };

        visaProductId = mkOption {
          type = types.str;
          description = "Moon Visa product ID (UUID)";
        };

        syncTx = mkOption {
          type = types.bool;
          default = false;
          description = "Whether to sync Moon transactions";
        };

        cardTopupFee = mkOption {
          type = types.str;
          default = null;
          description = "Percentage fee applied to topups of the Moon card";
          example = "0.01";
        };
      };

      sideshift = {
        secret = mkOption {
          type = types.str;
          description = "SideShift secret";
        };

        affiliateId = mkOption {
          type = types.str;
          description = "SideShift affiliate ID";
        };

        apiBaseUrl = mkOption {
          type = types.str;
          description = "SideShift API base URL";
        };

        commissionRate = mkOption {
          type = types.nullOr types.float;
          default = null;
          description = "SideShift commission rate";
        };
      };

      bringin = {
        url = mkOption {
          type = types.str;
          description = "Bringin API URL";
        };

        apiSecret = mkOption {
          type = types.str;
          description = "Bringin API secret";
        };

        apiKey = mkOption {
          type = types.str;
          description = "Bringin API key";
        };

        webhookUrl = mkOption {
          type = types.str;
          description = "Bringin webhook URL";
        };
      };

      etherscanApiKey = mkOption {
        type = types.str;
        description = "Etherscan API key";
      };

      # Optional settings with defaults
      useFakePrice = mkOption {
        type = types.bool;
        default = false;
        description = "Whether to use fake price data for testing";
      };

      customDbMigration = mkOption {
        type = types.bool;
        default = false;
        description = "Whether to use custom database migrations";
      };

      smtp = {
        host = mkOption {
          type = types.nullOr types.str;
          default = null;
          description = "SMTP host for email notifications";
        };

        port = mkOption {
          type = types.nullOr types.port;
          default = null;
          description = "SMTP port";
        };

        user = mkOption {
          type = types.nullOr types.str;
          default = null;
          description = "SMTP username";
        };

        pass = mkOption {
          type = types.nullOr types.str;
          default = null;
          description = "SMTP password";
        };

        from = mkOption {
          type = types.nullOr types.str;
          default = null;
          description = "SMTP from address";
        };

        disabled = mkOption {
          type = types.bool;
          default = true;
          description = "Whether SMTP is disabled";
        };
      };

      hubFeeWalletDir = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Hub fee wallet directory";
      };

      # Optional settings
      fakeClientIp = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Fake client IP for testing";
      };

      telegramBotToken = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Telegram bot token for notifications";
      };

      electrumUrl = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Electrum server URL for transaction monitoring";
        example = "tcp://electrum.blockstream.info:50001";
      };
    };
  };

  config = mkIf cfg.enable {
    systemd.services.lendasat = {
      description = "Lendasat Hub - Bitcoin lending platform backend";
      wantedBy = ["multi-user.target"];
      after = ["network-online.target"];
      wants = ["network-online.target"];

      serviceConfig = {
        Type = "simple";

        User = "lendasat";
        Group = "lendasat";

        StateDirectory = "lendasat";
        WorkingDirectory = "/var/lib/lendasat";
        ExecStart = "${cfg.package}/bin/hub";
        Restart = "on-failure";
        RestartSec = 10;

        # Security hardening
        NoNewPrivileges = true;
        ProtectHome = true;
        ProtectClock = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectControlGroups = true;
        RestrictNamespaces = true;
        LockPersonality = true;
        MemoryDenyWriteExecute = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        RemoveIPC = true;
        PrivateMounts = true;

        # Network access
        PrivateNetwork = false;
        IPAddressDeny = "localhost link-local multicast";
        IPAddressAllow = "any";

        # File system access
        ProtectSystem = "strict";
        ReadWritePaths = ["/var/lib/lendasat" "/tmp"];

        # Capabilities
        CapabilityBoundingSet = "";
        AmbientCapabilities = "";
      };

      environment = envVars;
    };

    # Ensure the hub package is available
    environment.systemPackages = [cfg.package];
  };
}
