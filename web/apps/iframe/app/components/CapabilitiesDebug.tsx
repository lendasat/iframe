import { useWallet } from "../hooks/useWallet";

/**
 * Debug component to display wallet capabilities
 * This component shows what features the connected wallet supports
 *
 * Usage:
 * Add this component to any route to see wallet capabilities:
 * ```tsx
 * <CapabilitiesDebug />
 * ```
 */
export function CapabilitiesDebug() {
  const { capabilities, capabilitiesLoading: loading } = useWallet();
  const error = !capabilities && !loading ? "No capabilities available" : null;

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-700">
          Loading wallet capabilities...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm text-red-700">Error: {error}</div>
      </div>
    );
  }

  if (!capabilities) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-700">
          No capabilities information available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Wallet Capabilities
      </h3>

      <div className="space-y-3 text-sm">
        {/* Bitcoin capabilities */}
        <div>
          <div className="font-medium text-gray-700 mb-1">Bitcoin</div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.bitcoin.signPsbt
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.bitcoin.signPsbt ? "✓" : "✗"}
              </span>
              <span>Sign PSBT (collateral withdrawal)</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.bitcoin.sendBitcoin
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.bitcoin.sendBitcoin ? "✓" : "✗"}
              </span>
              <span>Send Bitcoin</span>
            </li>
          </ul>
        </div>

        {/* Loan assets capabilities */}
        <div>
          <div className="font-medium text-gray-700 mb-1">Loan Assets</div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.loanAssets.canReceive
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.loanAssets.canReceive ? "✓" : "✗"}
              </span>
              <span>Can provide addresses for receiving</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.loanAssets.canSend
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.loanAssets.canSend ? "✓" : "✗"}
              </span>
              <span>Can send repayment transactions</span>
            </li>
            <li className="mt-2">
              <div className="text-gray-600 mb-1">Supported assets:</div>
              {capabilities.loanAssets.supportedAssets.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {capabilities.loanAssets.supportedAssets.map((asset) => (
                    <span
                      key={asset}
                      className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500 text-xs">None</span>
              )}
            </li>
          </ul>
        </div>

        {/* Nostr capabilities */}
        <div>
          <div className="font-medium text-gray-700 mb-1">Nostr</div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.nostr.hasNpub
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.nostr.hasNpub ? "✓" : "✗"}
              </span>
              <span>Has Nostr public key (npub)</span>
            </li>
          </ul>
        </div>

        {/* Ark capabilities */}
        <div>
          <div className="font-medium text-gray-700 mb-1">Ark</div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.ark.canReceive
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.ark.canReceive ? "✓" : "✗"}
              </span>
              <span>Can receive on Ark</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={
                  capabilities.ark.canSend
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {capabilities.ark.canSend ? "✓" : "✗"}
              </span>
              <span>Can send on Ark</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
