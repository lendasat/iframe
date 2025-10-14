# Lendasat Web Monorepo

This is the web frontend monorepo for Lendasat, built with Turborepo and Vite.

## Getting Started

Install dependencies:

```sh
pnpm install
```

Run the development servers:

```sh
pnpm dev
```

## What's inside?

This Turborepo includes the following packages and apps:

### Apps

- **`apps/iframe`**: Main Lendasat borrower application (runs in iframe)
  - React Router v7 app
  - Communicates with parent wallet via wallet-bridge
  - Manages loan contracts, applications, and offers

- **`apps/sample-wallet`**: Demo wallet application for testing
  - Embeds the iframe app
  - Implements wallet-bridge provider
  - Shows how to integrate Lendasat into a wallet

### Packages

- **`@lendasat/lendasat-wallet-bridge`**: Communication bridge between iframe and parent wallet
  - Type-safe PostMessage API
  - Handles authentication, signing, and wallet capabilities
  - Exports `LendasatClient` (for iframe) and `WalletProvider` (for parent wallet)

- **`@repo/api`**: API client for Lendasat backend
  - OpenAPI-generated TypeScript client
  - Handles authentication, contracts, offers, and applications
  - Price context provider

- **`@repo/ui`**: Shared UI components
  - Button, Spinner, and other reusable components
  - Tailwind CSS styling

- **`@repo/eslint-config`**: Shared ESLint configurations
- **`@repo/typescript-config`**: Shared `tsconfig.json` configurations

### Architecture

```
┌─────────────────────────────────────┐
│     Parent Wallet (sample-wallet)   │
│  ┌───────────────────────────────┐  │
│  │   Lendasat iframe (apps/iframe) │  │
│  │                                 │  │
│  │   - Loan management UI          │  │
│  │   - Uses LendasatClient         │  │
│  └───────────────────────────────┘  │
│                                       │
│   - Uses WalletProvider               │
│   - Signs transactions & messages     │
│   - Provides capabilities             │
└─────────────────────────────────────┘
```

### Authentication Flow

The iframe app uses **secp256k1 pubkey challenge-response authentication**:

1. Iframe requests public key from wallet via wallet-bridge
2. Iframe requests challenge from backend
3. Wallet signs challenge with private key (ECDSA signature in DER format)
4. Iframe sends signature to backend for verification
5. Backend returns JWT token for authenticated requests

### Environment Variables

Create `.env` files in each app:

**`apps/iframe/.env`**:

```env
VITE_BORROWER_BASE_URL=http://localhost:7337
```

**`apps/sample-wallet/.env`**:

```env
VITE_IFRAME_URL=http://localhost:5173
```

### Development

Each package and app is 100% [TypeScript](https://www.typescriptlang.org/).

Build all packages:

```sh
pnpm build
```

Run tests:

```sh
pnpm test
```

Lint:

```sh
pnpm lint
```

### Utilities

This Turborepo has some additional tools already setup:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vite](https://vitejs.dev/) for fast development and building
