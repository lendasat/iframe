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
import { LendasatClient } from '@lendasat/lendasat-wallet-bridge';

// Create a client instance
const client = new LendasatClient();

// Request borrower's public key
const publicKey = await client.getPublicKey();
console.log('Public Key:', publicKey);

// Get derivation path
const path = await client.getDerivationPath();
console.log('Derivation Path:', path);

// Get API key
const apiKey = await client.getApiKey();
console.log('API Key:', apiKey);

// Get Bitcoin address
const btcAddress = await client.getAddress('bitcoin');
console.log('Bitcoin Address:', btcAddress);

// Get loan asset address (e.g., USDC on Polygon)
const usdcAddress = await client.getAddress('loan_asset', 'UsdcPol');
console.log('USDC Address:', usdcAddress);

// Get Nostr public key (npub format)
const npub = await client.getNpub();
console.log('Nostr npub:', npub);

// Sign a PSBT
const signedPsbt = await client.signPsbt(psbtBase64);
console.log('Signed PSBT:', signedPsbt);
```

### For Parent Wallet

Use `WalletProvider` to handle requests from the Lendasat iframe:

```typescript
import { WalletProvider, AddressType } from '@lendasat/lendasat-wallet-bridge';

// Create provider with handler functions
const provider = new WalletProvider(
  {
    // Return the borrower's public key (hex-encoded, compressed 33 bytes)
    onGetPublicKey: () => {
      return keyPair.publicKey.toString('hex');
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
          if (asset === 'UsdcPol') {
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
  ['http://localhost:5173'] // Allowed iframe origins
);

// Start listening to iframe messages
provider.listen(iframeElement);

// Clean up when done
// provider.destroy();
```

## API Reference

### LendasatClient

Client for the Lendasat iframe to communicate with parent wallet.

#### Methods

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

## Support

For issues and questions, please visit [GitHub Issues](https://github.com/lendasat/lendasat/issues).
