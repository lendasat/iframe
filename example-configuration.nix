# Example NixOS configuration using the Lendasat module
#
# To use this in your NixOS configuration:
# 1. Add this flake as an input
# 2. Import the module
# 3. Configure the service
#
# inputs.lendasat.url = "github:lendasat/lendasat";
#
# imports = [
#   inputs.lendasat.nixosModules.default
# ];
{
  config,
  pkgs,
  ...
}: {
  services.lendasat = {
    enable = true;

    settings = {
      # Required core settings
      databaseUrl = "postgres://hub:password@localhost:5432/hub";
      mempoolRestUrl = "https://mempool.space/api";
      mempoolWsUrl = "wss://mempool.space/api/v1/ws";
      network = "mainnet";
      seedFile = "/var/lib/lendasat/seed";
      fallbackXpub = "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8";
      jwtSecret = "your-jwt-secret-here";

      # Frontend origins
      borrowerFrontendOrigin = "https://borrow.example.com";
      lenderFrontendOrigin = "https://lend.example.com";

      # Hub configuration
      hubFeeDescriptor = "wpkh([2e8978e5/84h/1h/0h]tpubDDMuC8nQpQtPV3Q7BTdempTBYG3tZ5McJRwTVYDXVPR7oiUxTR5DjKKB1aa4yi5C74DK4R8Z4WRHt8GAy5WkVUTksUZbDoLEEgoz2aaZXU7/0/*)#eara5f0t";
      hubOriginationFee = "0,100,1.5";
      hubExtensionOriginationFee = "0,100,1";
      fallbackNpub = "npub16d3ewav9e39xctevl6nwcj6k62nm3dhk2g0jgj7n2vhc2m35989s5ej0d8";

      # API configurations (you need to provide your own keys)
      moon = {
        apiKey = "your-moon-api-key";
        apiUrl = "https://api.paywithmoon.com/v1/api-gateway";
        webhookUrl = "https://yourdomain.com/api/moon/webhook";
        visaProductId = "8f1c611d-098d-4f61-b106-f7b6d344b1ae";
        syncTx = false;
      };

      sideshift = {
        secret = "your-sideshift-secret";
        affiliateId = "your-affiliate-id";
        apiBaseUrl = "https://sideshift.ai/api/v2";
        commissionRate = 0.0;
      };

      bringin = {
        url = "https://api.bringin.xyz/api/v0";
        apiSecret = "your-bringin-api-secret";
        apiKey = "your-bringin-api-key";
        webhookUrl = "https://yourdomain.com/api/bringin/callback";
      };

      etherscanApiKey = "your-etherscan-api-key";

      # Optional settings
      useFakePrice = false;
      customDbMigration = false;

      # SMTP configuration (optional)
      smtp = {
        host = "smtp.example.com";
        port = 587;
        user = "noreply@example.com";
        pass = "your-smtp-password";
        from = "noreply@example.com";
        disabled = false;
      };

      # Optional features
      telegramBotToken = null; # Set to enable Telegram notifications
      electrumUrl = null; # Set to "tcp://electrum.blockstream.info:50001" for mempool monitoring
    };
  };
}
