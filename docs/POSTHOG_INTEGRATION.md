# PostHog Analytics Integration

## Overview

PostHog analytics has been integrated into the borrower and lender applications using a minimal approach that reuses the existing PostHog project from the website.

## Implementation

### 1. Architecture

- **Shared Analytics Module**: Created in `frontend/packages/ui-shared/src/analytics/`
  - `posthog-provider.tsx`: React provider component that wraps the app
  - `analytics.ts`: Utility functions for tracking events
  - Automatically tags all events with `app_type` ("borrower" or "lender")

### 2. Configuration

Environment variables (already added to `.env`):
```bash
VITE_POSTHOG_KEY=phc_3MrZhmMPhgvjtBN54e9aDhV2iVAom8t3ocDizQxofyw
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

### 3. Installation

Install PostHog dependency:
```bash
cd /mnt/c/lendasat/frontend
pnpm add posthog-js --filter ui-shared
pnpm install
```

## Usage Examples

### Track Custom Events

```typescript
import { trackEvent } from "@frontend/ui-shared";

// Simple event tracking - PostHog will automatically group and analyze these
trackEvent("loan_application_started", {
  loan_amount: 10000,
  duration_months: 12
});

trackEvent("user_login", { method: "wallet" });

trackEvent("offer_created", {
  offer_id: "offer-123",
  amount: 5000,
  interest_rate: 5.5
});
```

### Using React Hook

```typescript
import { useAnalytics } from "@frontend/ui-shared";

function MyComponent() {
  const posthog = useAnalytics();

  const handleClick = () => {
    posthog?.capture("custom_event", {
      property1: "value1",
      property2: 123
    });
  };

  return <button onClick={handleClick}>Track Event</button>;
}
```

### Identify Users

```typescript
import { useAnalytics } from "@frontend/ui-shared";

function LoginComponent() {
  const posthog = useAnalytics();

  const handleLogin = (userId: string, email: string) => {
    // Identify the user
    posthog?.identify(userId, {
      email: email,
      user_type: "borrower" // or "lender"
    });

    // Track login event
    LoanAnalytics.login("email");
  };

  return /* your login UI */;
}
```

## Features Enabled

1. **Automatic Page View Tracking**: Enabled by default
2. **Auto-capture**: Clicks and form submissions on buttons and links
3. **User Segmentation**: All events tagged with app_type (borrower/lender/website)
4. **Environment Tracking**: Development vs production mode
5. **Session Recording**: Enabled with security measures
   - All input fields are masked by default for security
   - Sensitive elements with `data-private` attribute are masked
   - Network requests with sensitive URLs are filtered
   - Recording can be paused on sensitive pages

## Event Naming Convention

PostHog automatically groups and analyzes events, so use descriptive names:

- **User Events**: `user_login`, `user_logout`, `user_registered`
- **Loan Events**: `loan_application_started`, `loan_application_submitted`, `loan_approved`, `loan_rejected`
- **Offer Events**: `offer_created`, `offer_accepted`, `offer_rejected`
- **Payment Events**: `payment_made`, `payment_failed`, `payment_scheduled`
- **Navigation**: Page views are tracked automatically

PostHog will automatically create insights, funnels, and cohorts based on these event names.

## Dashboard Access

View analytics at: https://eu.posthog.com

Use filters to segment by:
- `app_type`: "borrower" or "lender"
- `environment`: "development" or "production"

## Security Measures

### CRITICAL: Protecting Sensitive Data

PostHog session recording is configured with multiple layers of protection:

#### 1. Global Configuration
- `maskAllInputs: true` - All input fields masked by default
- `maskTextSelector` for CSS selectors: `[data-private]`, `.mnemonic`, `.seed-phrase`, `.private-key`, `.secret`
- Network request filtering for sensitive URLs

#### 2. Marking Sensitive Elements
Add these attributes to any element containing sensitive data:
```tsx
<div data-private="true" className="mnemonic">
  {sensitiveData}
</div>
```

#### 3. Pausing Recording on Sensitive Pages
Use the `useSensitivePage` hook:
```tsx
import { useSensitivePage } from "@frontend/ui-shared";

function WalletPage() {
  useSensitivePage(true); // Pauses recording
  return <div>...</div>;
}
```

#### 4. Protected Components
- Mnemonic seed phrases - Fully masked
- Nostr private keys (nsec) - Fully masked
- Wallet settings pages - Recording paused
- All password inputs - Auto-masked by default

## Privacy Considerations

- Personal data is only captured after user identification
- Cookie consent is not required as PostHog is configured for product analytics
- For GDPR compliance, user deletion can be requested through PostHog dashboard
- Sensitive data (mnemonics, private keys) are never recorded