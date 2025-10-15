import { useParams, useNavigate } from "react-router";
import { useAsync, useAsyncRetry } from "react-use";
import { useState, useEffect } from "react";
import type { Route } from "../+types/app.contracts.$contractId.fund";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "~/hooks/useWallet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Fund Contract - Lendasat" },
    { name: "description", content: "Fund your contract" },
  ];
}

export default function FundContract() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { client, isConnected, capabilities, capabilitiesLoading } =
    useWallet();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCollateralSats, setCopiedCollateralSats] = useState(false);
  const [copiedCollateralBtc, setCopiedCollateralBtc] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [fundingSuccess, setFundingSuccess] = useState<string | null>(null);
  const [contract, setContract] = useState<any>(null);

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

  const handleFundWithWallet = async () => {
    if (!client || !displayContract || !displayContract.contractAddress) {
      return;
    }

    try {
      setIsFunding(true);
      setFundingError(null);
      setFundingSuccess(null);

      const txid = await client.sendToAddress(
        displayContract.contractAddress,
        displayContract.initialCollateralSats,
        "bitcoin",
      );

      setFundingSuccess(txid);
      console.log("Transaction sent successfully:", txid);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setFundingError(errorMessage);
      console.error("Failed to fund contract:", err);
    } finally {
      setIsFunding(false);
    }
  };

  // Initial fetch
  const contractState = useAsyncRetry(async () => {
    if (!contractId) return null;
    const result = await apiClient.contractDetails(contractId);
    setContract(result);
    return result;
  }, [contractId]);

  // Poll for updates every 3 seconds, only update if status changed
  useEffect(() => {
    if (!contractId || !contract) return;

    const interval = setInterval(async () => {
      try {
        const updated = await apiClient.contractDetails(contractId);
        // Only update state if status has changed
        if (updated && updated.status !== contract.status) {
          setContract(updated);
        }
      } catch (err) {
        console.error("Failed to poll contract updates:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [contractId, contract]);

  // Use local contract state for rendering
  const displayContract = contract || contractState.value;

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

      {displayContract === null && !contractState.loading && (
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

      {displayContract && (
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
                {displayContract.contractAddress ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 bg-white p-2 rounded-lg">
                        <QRCodeSVG
                          value={displayContract.contractAddress.toLowerCase()}
                          size={120}
                          level="M"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-mono text-gray-900 break-all flex-1">
                            {displayContract.contractAddress}
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                displayContract?.contractAddress || "",
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
                          href={`https://mempool.space/address/${displayContract.contractAddress}`}
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
                      {displayContract.initialCollateralSats.toLocaleString()}{" "}
                      sats
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          displayContract?.initialCollateralSats.toString() ||
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
                        displayContract.initialCollateralSats / 100_000_000
                      ).toFixed(8)}{" "}
                      BTC
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          (
                            displayContract?.initialCollateralSats /
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
                      {displayContract.loanAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Duration:</span>
                    <span className="font-medium text-blue-900">
                      {displayContract.durationDays} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Interest:</span>
                    <span className="font-medium text-blue-900">
                      $
                      {displayContract.interest.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ({(displayContract.interestRate * 100).toFixed(2)}% p.a.)
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

          {/* Fund with Wallet */}
          {isConnected &&
            displayContract.contractAddress &&
            capabilities?.bitcoin.sendBitcoin && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Fund with Wallet
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Send the required collateral directly from your connected
                  wallet.
                </p>

                {fundingSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex">
                      <svg
                        className="w-5 h-5 text-green-600 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-green-800">
                          Transaction Sent Successfully!
                        </h4>
                        <p className="text-sm text-green-700 mt-1 break-all">
                          Transaction ID: {fundingSuccess}
                        </p>
                        <a
                          href={`https://mempool.space/tx/${fundingSuccess}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-sm font-medium inline-flex items-center mt-2"
                        >
                          View on Mempool →
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {fundingError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex">
                      <svg
                        className="w-5 h-5 text-red-600 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-red-800">
                          Transaction Failed
                        </h4>
                        <p className="text-sm text-red-700 mt-1">
                          {fundingError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleFundWithWallet}
                  disabled={isFunding || !displayContract.contractAddress}
                  className="w-full"
                >
                  {isFunding ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Sending Transaction...
                    </>
                  ) : (
                    `Fund Contract (${displayContract.initialCollateralSats.toLocaleString()} sats)`
                  )}
                </Button>
              </div>
            )}

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
