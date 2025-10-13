import { useParams, useNavigate } from "react-router";
import { useAsync } from "react-use";
import { useState } from "react";
import type { Route } from "../+types/app.contracts.$contractId.fund";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Fund Contract - Lendasat" },
    { name: "description", content: "Fund your contract" },
  ];
}

export default function FundContract() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCollateralSats, setCopiedCollateralSats] = useState(false);
  const [copiedCollateralBtc, setCopiedCollateralBtc] = useState(false);

  const copyToClipboard = async (
    text: string,
    setter: (value: boolean) => void,
  ) => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API or when permissions are denied
      try {
        // Create a temporary textarea element
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setter(true);
        setTimeout(() => setter(false), 2000);
      } catch (fallbackErr) {
        console.error("Failed to copy:", err, fallbackErr);
      }
    }
  };

  // Fetch the specific contract
  const contractState = useAsync(async () => {
    if (!contractId) return null;
    return await apiClient.contractDetails(contractId);
  }, [contractId]);

  if (!contractId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600">Invalid contract ID</p>
          <Button
            onClick={() => navigate("/app/contracts")}
            variant="outline"
            className="mt-4"
          >
            Back to Contracts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/app/contracts/${contractId}`)}
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
          Back to Contract Details
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Fund Contract</h1>
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
          <Button
            onClick={() => navigate("/app/contracts")}
            variant="outline"
            className="mt-4"
          >
            Back to Contracts
          </Button>
        </div>
      )}

      {contractState.value && (
        <div className="space-y-6">
          {/* Funding Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Funding Instructions
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  To fund this contract, send the required collateral amount to
                  the contract address below:
                </p>
              </div>

              {/* Contract Address with QR Code */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">Contract Address</p>
                {contractState.value.contractAddress ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 bg-white p-2 rounded-lg">
                        <QRCodeSVG
                          value={contractState.value.contractAddress.toLowerCase()}
                          size={120}
                          level="M"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-mono text-gray-900 break-all flex-1">
                            {contractState.value.contractAddress}
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                contractState.value?.contractAddress || "",
                                setCopiedAddress,
                              )
                            }
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                            title="Copy address"
                          >
                            {copiedAddress ? (
                              <svg
                                className="w-5 h-5 text-green-600"
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
                                className="w-5 h-5"
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
                        <a
                          href={`https://mempool.space/address/${contractState.value.contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          View on Mempool →
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    Contract address not yet available
                  </p>
                )}
              </div>

              {/* Required Collateral Amount */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Required Collateral Amount
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-gray-900">
                      {contractState.value.initialCollateralSats.toLocaleString()}{" "}
                      sats
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          contractState.value?.initialCollateralSats.toString() ||
                            "",
                          setCopiedCollateralSats,
                        )
                      }
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy sats amount"
                    >
                      {copiedCollateralSats ? (
                        <svg
                          className="w-5 h-5 text-green-600"
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
                          className="w-5 h-5"
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {(
                        contractState.value.initialCollateralSats / 100_000_000
                      ).toFixed(8)}{" "}
                      BTC
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          (
                            contractState.value?.initialCollateralSats /
                              100_000_000 || 0
                          ).toFixed(8),
                          setCopiedCollateralBtc,
                        )
                      }
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy BTC amount"
                    >
                      {copiedCollateralBtc ? (
                        <svg
                          className="w-5 h-5 text-green-600"
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
                          className="w-5 h-5"
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
              </div>

              {/* Loan Details Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  Loan Details
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Loan Amount:</span>
                    <span className="font-medium text-blue-900">
                      $
                      {contractState.value.loanAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Duration:</span>
                    <span className="font-medium text-blue-900">
                      {contractState.value.durationDays} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Interest:</span>
                    <span className="font-medium text-blue-900">
                      $
                      {contractState.value.interest.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ({(contractState.value.interestRate * 100).toFixed(2)}%
                      p.a.)
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">
                      Important
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Please ensure you send at least the required collateral
                      amount to the contract address. The lender will disburse
                      once the collateral is confirmed on the blockchain.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(`/app/contracts/${contractId}`)}
              variant="outline"
              className="flex-1"
            >
              Back to Contract
            </Button>
            <Button
              onClick={() => navigate("/app/contracts")}
              variant="default"
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
