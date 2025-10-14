import { useParams, useNavigate } from "react-router";
import { useAsync } from "react-use";
import { useState } from "react";
import type { Route } from "../+types/app.contracts.$contractId";
import { apiClient, calculateCurrentLtv, Currency } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { usePriceForCurrency } from "@repo/api/price-context";
import { CancelContractAction } from "~/components/contract-actions/CancelContractAction";
import { FundContractAction } from "~/components/contract-actions/FundContractAction";
import { RepayLoanAction } from "~/components/contract-actions/RepayLoanAction";
import { WithdrawCollateralAction } from "~/components/contract-actions/WithdrawCollateralAction";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contract Details - Lendasat" },
    { name: "description", content: "View contract details" },
  ];
}

export default function ContractDetails() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const btcPrice = usePriceForCurrency(Currency.USD);

  // Fetch the specific contract
  const contractState = useAsync(async () => {
    if (!contractId) return null;
    return await apiClient.contractDetails(contractId);
  }, [contractId]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!contractId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600">Invalid contract ID</p>
          <button
            onClick={() => navigate("/app/contracts")}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Contracts
          </button>
        </div>
      </div>
    );
  }

  const currentLtv = calculateCurrentLtv(
    contractState.value?.loanAmount,
    contractState.value?.collateralSats,
    btcPrice,
  );

  return (
    <div>
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/app/contracts")}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Contracts
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Contract Details</h1>
      </div>

      {contractState.loading && (
        <LoadingOverlay message="Loading contract details..." />
      )}

      {contractState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading contract: {contractState.error.message}
        </div>
      )}

      {contractState.value === null && !contractState.loading && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Contract not found.</p>
          <button
            onClick={() => navigate("/app/contracts")}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Contracts
          </button>
        </div>
      )}

      {contractState.value && (
        <div className="space-y-6">
          {/* Status Badge & ID */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Contract
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-gray-600">
                    {contractState.value.id}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(contractState.value?.id || "")
                    }
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  contractState.value.status === "PrincipalGiven"
                    ? "bg-green-100 text-green-800"
                    : contractState.value.status === "Requested"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {contractState.value.status}
              </span>
            </div>

            {/* Action Buttons */}
            {contractState.value.status === "Requested" && (
              <div className="mt-4">
                <CancelContractAction contractId={contractState.value.id} />
              </div>
            )}
            {contractState.value.status === "Approved" && (
              <div className="mt-4 flex gap-3">
                <div className="flex-1">
                  <CancelContractAction contractId={contractState.value.id} />
                </div>
                <div className="flex-1">
                  <FundContractAction contractId={contractState.value.id} />
                </div>
              </div>
            )}
            {contractState.value.status === "PrincipalGiven" && (
              <div className="mt-4">
                <RepayLoanAction contractId={contractState.value.id} />
              </div>
            )}
            {contractState.value.status === "RepaymentConfirmed" && (
              <div className="mt-4">
                <WithdrawCollateralAction contractId={contractState.value.id} />
              </div>
            )}
          </div>

          {/* Loan Details - Compact */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Loan Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Loan Amount</p>
                <p className="text-lg font-semibold text-gray-900">
                  $
                  {contractState.value.loanAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Interest Rate</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(contractState.value.interestRate * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Interest Amount</p>
                <p className="text-lg font-semibold text-gray-900">
                  $
                  {(
                    (contractState.value.loanAmount *
                      contractState.value.interestRate *
                      contractState.value.durationDays) /
                    365
                  ).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Duration</p>
                <p className="text-lg font-semibold text-gray-900">
                  {contractState.value.durationDays} days
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Expiry Date</span>
                <span className="font-medium text-gray-900">
                  {contractState.value.expiry.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Collateral Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Collateral
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <p className="text-gray-600 mb-1">Amount</p>
                <p className="text-lg font-semibold text-gray-900">
                  {contractState.value.collateralSats.toLocaleString()} sats
                </p>
                <p className="text-xs text-gray-500">
                  {(contractState.value.collateralSats / 100_000_000).toFixed(
                    8,
                  )}{" "}
                  BTC
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">LTV</p>
                <p className="text-lg font-semibold text-gray-900">
                  {currentLtv && Number.isFinite(currentLtv)
                    ? `${(currentLtv * 100).toFixed(1)}%`
                    : "N/A"}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Contract Address</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-gray-900 break-all flex-1">
                      {contractState.value.contractAddress || "Not yet created"}
                    </p>
                    {contractState.value.contractAddress && (
                      <a
                        href={`https://mempool.space/address/${contractState.value.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium whitespace-nowrap"
                      >
                        View on Mempool →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Transaction History
            </h3>
            <div className="space-y-3">
              {contractState.value.transactions.length > 0 ? (
                contractState.value.transactions
                  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-start py-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100">
                          <svg
                            className="w-5 h-5 text-indigo-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {tx.transactionType}
                            </p>
                            <p className="text-sm text-gray-500">
                              {tx.timestamp.toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <a
                            href={`https://mempool.space/tx/${tx.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium whitespace-nowrap ml-4"
                          >
                            View TX →
                          </a>
                        </div>
                        <p className="text-xs font-mono text-gray-500 mt-1 break-all">
                          {tx.txid}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No transactions yet
                </div>
              )}
            </div>
          </div>

          {/* Lender Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Lender Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Lender ID</p>
                <p className="text-sm font-mono text-gray-900">
                  {contractState.value.lender.name} -{" "}
                  {contractState.value.lender.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
