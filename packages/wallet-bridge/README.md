# @lendasat/lendasat-wallet-bridge

Type-safe communication bridge between Lendasat iframe and parent wallet applications.

## Installation

```bash
npm install @lendasat/lendasat-wallet-bridge
# or
pnpm add @lendasat/lendasat-wallet-bridge
# or
yarn add @lendasat/lendasat-wallet-bridge
```

## Overview

This library provides a secure, type-safe communication layer between the Lendasat application (embedded in an iframe) and parent wallet applications. It handles message passing, request/response cycles, and error handling for wallet operations.

## Usage

### For Iframe (Lendasat App)

Use `LendasatClient` to request wallet operations from the parent window:

```typescript
import { LendasatClient } from "@lendasat/lendasat-wallet-bridge";

// Create a client instance
const client = new LendasatClient();

// Request borrower's public key
const publicKey = await client.getPublicKey();
console.log("Public Key:", publicKey);

// Get derivation path
const path = await client.getDerivationPath();
console.log("Derivation Path:", path);

// Get API key
const apiKey = await client.getApiKey();
console.log("API Key:", apiKey);

// Get Bitcoin address
const btcAddress = await client.getAddress("bitcoin");
console.log("Bitcoin Address:", btcAddress);

// Get loan asset address (e.g., USDC on Polygon)
const usdcAddress = await client.getAddress("loan_asset", "UsdcPol");
console.log("USDC Address:", usdcAddress);

// Get Nostr public key (npub format)
const npub = await client.getNpub();
console.log("Nostr npub:", npub);

// Sign a PSBT
const signedPsbt = await client.signPsbt(psbtBase64);
console.log("Signed PSBT:", signedPsbt);
```

### For Parent Wallet

Use `WalletProvider` to handle requests from the Lendasat iframe:

```typescript
import { AddressType, WalletProvider } from "@lendasat/lendasat-wallet-bridge";

// Create provider with handler functions
const provider = new WalletProvider(
  {
    // Declare wallet capabilities (required)
    capabilities: {
      bitcoin: {
        signPsbt: true,
        sendBitcoin: false,
      },
      loanAssets: {
        supportedAssets: ["UsdcPol", "UsdtEth"],
        canReceive: true,
        canSend: false,
      },
      nostr: {
        hasNpub: false,
      },
      ark: {
        canSend: false,
        canReceive: false,
      },
    },

    // Return the borrower's public key (hex-encoded, compressed 33 bytes)
    onGetPublicKey: () => {
      return keyPair.publicKey.toString("hex");
    },

    // Return the BIP32 derivation path
    onGetDerivationPath: () => {
      return "m/84'/0'/0'/0/0";
    },

    // Return the Lendasat API key
    onGetApiKey: () => {
      return process.env.LENDASAT_API_KEY;
    },

    // Return addresses based on type
    onGetAddress: (addressType, asset) => {
      switch (addressType) {
        case AddressType.BITCOIN:
          return bitcoinAddress;
        case AddressType.ARK:
          return arkAddress;
        case AddressType.LOAN_ASSET:
          // Return address for specific loan asset
          if (asset === "UsdcPol") {
            return polygonAddress;
          }
          // ... handle other assets
          return null; // Return null if not supported
        default:
          return null;
      }
    },

    // Return Nostr public key in npub format (optional)
    onGetNpub: () => {
      return convertToNpub(keyPair.publicKey) || null;
    },

    // Sign a PSBT with the wallet's private key
    onSignPsbt: (psbtBase64) => {
      const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
      psbt.signAllInputs(keyPair);
      psbt.finalizeAllInputs();
      return psbt.toBase64();
    },
  },
  ["http://localhost:5173"], // Allowed iframe origins
);

// Start listening to iframe messages
provider.listen(iframeElement);

// Clean up when done
// provider.destroy();
```

## Wallet Capabilities

The bridge includes a capabilities discovery system that allows the iframe to query what features the wallet supports. This enables better UX by hiding/disabling unavailable features.

```typescript
// In iframe
const capabilities = await client.getCapabilities();

if (capabilities.bitcoin.signPsbt) {
  // Show withdraw button
}

if (capabilities.loanAssets.supportedAssets.includes("UsdcPol")) {
  // Can accept USDC on Polygon
}
```

Capabilities are cached after the first request for performance.

## API Reference

### LendasatClient

Client for the Lendasat iframe to communicate with parent wallet.

#### Methods

- `getCapabilities(): Promise<WalletCapabilities>` - Get wallet capabilities (cached)
- `getPublicKey(): Promise<string>` - Get the borrower's public key (hex-encoded, compressed)
- `getDerivationPath(): Promise<string>` - Get the BIP32 derivation path
- `getApiKey(): Promise<string>` - Get the Lendasat API key
- `getAddress(addressType: AddressType, asset?: LoanAsset): Promise<string | null>` - Get an address by type
- `getNpub(): Promise<string | null>` - Get the Nostr public key (npub format)
- `signPsbt(psbt: string): Promise<string>` - Sign a PSBT (base64-encoded)

### WalletProvider

Provider for parent wallets to handle requests from Lendasat iframe.

#### Constructor

```typescript
new WalletProvider(handlers: WalletHandlers, allowedOrigins?: string[])
```

- `handlers` - Object containing handler functions for each wallet operation
- `allowedOrigins` - Array of allowed iframe origins (default: `["*"]`)

#### Methods

- `listen(iframe?: HTMLIFrameElement): void` - Start listening to messages
- `destroy(): void` - Stop listening and clean up

### Types

#### AddressType

```typescript
enum AddressType {
  BITCOIN = "bitcoin",
  ARK = "ark",
  LOAN_ASSET = "loan_asset",
}
```

#### LoanAsset

Supported loan assets:

- `"UsdcPol"` - USDC on Polygon
- `"UsdtPol"` - USDT on Polygon
- `"UsdcEth"` - USDC on Ethereum
- `"UsdtEth"` - USDT on Ethereum
- `"UsdcStrk"` - USDC on Starknet
- `"UsdtStrk"` - USDT on Starknet
- `"UsdcSol"` - USDC on Solana
- `"UsdtSol"` - USDT on Solana
- `"UsdtLiquid"` - USDT on Liquid
- `"Usd"`, `"Eur"`, `"Chf"`, `"Mxn"` - Fiat currencies

## Security Considerations

1. **Origin Validation**: Always specify `allowedOrigins` in production to prevent unauthorized access
2. **Error Handling**: The library will throw errors for failed operations - handle them appropriately
3. **Timeout**: Requests will timeout after 30 seconds by default
4. **HTTPS**: Use HTTPS in production for secure communication

## Examples

See the [sample-wallet](../../apps/sample-wallet) directory for a complete working example.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Publishing

This package is published to npm as `@lendasat/lendasat-wallet-bridge`.

### Prerequisites

1. Ensure you have npm publish access to the `@lendasat` organization
2. Make sure you're logged in to npm: `npm login`
3. Update the version in `package.json` following [semantic versioning](https://semver.org/)

### Publishing Steps

From the root of the monorepo:

```bash
# Navigate to the package directory
cd web/packages/wallet-bridge

# Build the package
pnpm build

# Publish to npm
npm publish --access public
```

Or use the workspace command from the monorepo root:

```bash
# Build the package
pnpm --filter @lendasat/lendasat-wallet-bridge build

# Publish the package
pnpm --filter @lendasat/lendasat-wallet-bridge publish --access public
```

### Version Management

Follow semantic versioning:
- **Patch** (1.0.x): Bug fixes and minor changes
- **Minor** (1.x.0): New features that are backward compatible
- **Major** (x.0.0): Breaking changes

Update the version before publishing:

```bash
# Bump patch version (1.0.0 -> 1.0.1)
npm version patch

# Bump minor version (1.0.0 -> 1.1.0)
npm version minor

# Bump major version (1.0.0 -> 2.0.0)
npm version major
```

## Support

For issues and questions, please visit [GitHub Issues](https://github.com/lendasat/lendasat/issues).
