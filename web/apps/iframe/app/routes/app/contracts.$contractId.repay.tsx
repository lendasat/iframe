import { useParams, useNavigate } from "react-router";
import { useAsync } from "react-use";
import { useState } from "react";
import type { Route } from "../+types/app.contracts.$contractId.repay";
import { apiClient, formatLoanAsset, isFiatAsset } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "~/hooks/useWallet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Repay Loan - Lendasat" },
    { name: "description", content: "Repay your loan" },
  ];
}

export default function RepayLoan() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { client, isConnected } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmountSats, setCopiedAmountSats] = useState(false);
  const [copiedAmountBtc, setCopiedAmountBtc] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const [repaymentSuccess, setRepaymentSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"connected" | "external">(
    "connected",
  );
  const [txidInput, setTxidInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const copyToClipboard = async (
    text: string,
    setter: (value: boolean) => void,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleRepayWithWallet = async () => {
    if (!client || !contractState.value) {
      return;
    }

    const repaymentAddress =
      contractState.value.loanRepaymentAddress ||
      contractState.value.btcLoanRepaymentAddress;

    if (!repaymentAddress) {
      setRepaymentError("No repayment address available");
      return;
    }

    // Find the next pending installment
    const pendingInstallment = contractState.value.installments
      .filter((inst) => inst.status === "pending")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    if (!pendingInstallment) {
      setRepaymentError("No pending installments found for this contract");
      return;
    }

    try {
      setIsRepaying(true);
      setRepaymentError(null);
      setRepaymentSuccess(null);

      // Convert balance from USD to the smallest unit of the loan asset
      // For stablecoins, typically 6 decimals (USDC/USDT)
      // For now, we'll use balanceOutstanding as-is since it's already in the correct unit
      const txid = await client.sendToAddress(
        repaymentAddress,
        contractState.value.balanceOutstanding,
        contractState.value.loanAsset,
      );

      // Mark the installment as paid
      await apiClient.repaidContract(
        contractState.value.id,
        txid,
        pendingInstallment.id,
      );

      setRepaymentSuccess(txid);
      console.log("Repayment transaction sent successfully:", txid);
      navigate(`/app/contracts/${contractId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setRepaymentError(errorMessage);
      console.error("Failed to repay loan:", err);
    } finally {
      setIsRepaying(false);
    }
  };

  const handleSubmitExternalRepayment = async () => {
    if (!contractState.value || !txidInput.trim()) {
      return;
    }

    // Find the next pending installment
    const pendingInstallment = contractState.value.installments
      .filter((inst) => inst.status === "pending")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    if (!pendingInstallment) {
      setSubmitError("No pending installments found for this contract");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      await apiClient.repaidContract(
        contractState.value.id,
        txidInput.trim(),
        pendingInstallment.id,
      );

      setSubmitSuccess(true);
      setTxidInput("");
      console.log("Repayment recorded successfully");
      navigate(`/app/contracts/${contractId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setSubmitError(errorMessage);
      console.error("Failed to submit repayment:", err);
    } finally {
      setIsSubmitting(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Repay Loan</h1>
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
          {/* Repayment Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Repayment Instructions
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  To repay this loan, send the outstanding balance to the
                  repayment address below:
                </p>
              </div>

              {/* Repayment Address with QR Code */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">Repayment Address</p>
                {contractState.value.loanRepaymentAddress ||
                contractState.value.btcLoanRepaymentAddress ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 bg-white p-2 rounded-lg">
                        <QRCodeSVG
                          value={(
                            contractState.value.loanRepaymentAddress ||
                            contractState.value.btcLoanRepaymentAddress ||
                            ""
                          ).toLowerCase()}
                          size={120}
                          level="M"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-mono text-gray-900 break-all flex-1">
                            {contractState.value.loanRepaymentAddress ||
                              contractState.value.btcLoanRepaymentAddress}
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                contractState.value?.loanRepaymentAddress ||
                                  contractState.value
                                    ?.btcLoanRepaymentAddress ||
                                  "",
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
                        {contractState.value.btcLoanRepaymentAddress && (
                          <a
                            href={`https://mempool.space/address/${contractState.value.btcLoanRepaymentAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            View on Mempool →
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    Repayment address not available
                  </p>
                )}
              </div>

              {/* Balance Outstanding */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Balance Outstanding
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-gray-900">
                      $
                      {contractState.value.balanceOutstanding.toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          contractState.value?.balanceOutstanding.toFixed(2) ||
                            "",
                          setCopiedAmountSats,
                        )
                      }
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy USD amount"
                    >
                      {copiedAmountSats ? (
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
                      ≈{" "}
                      {contractState.value.balanceOutstanding.toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}{" "}
                      {formatLoanAsset(contractState.value.loanAsset)}
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          contractState.value?.balanceOutstanding.toFixed(2) ||
                            "",
                          setCopiedAmountBtc,
                        )
                      }
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy loan asset amount"
                    >
                      {copiedAmountBtc ? (
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
                      Please ensure you send the exact balance outstanding to
                      the repayment address. Sending less may result in the loan
                      not being marked as repaid.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Repayment Options */}
          <div className="bg-white rounded-lg shadow">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab("connected")}
                  className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                    activeTab === "connected"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Connected Wallet
                </button>
                <button
                  onClick={() => setActiveTab("external")}
                  className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                    activeTab === "external"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  External Wallet
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Connected Wallet Tab */}
              {activeTab === "connected" && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Repay with Connected Wallet
                  </h2>
                  {!isConnected ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-700">
                        No wallet connected. Please use the External Wallet
                        option to submit your repayment transaction ID.
                      </p>
                    </div>
                  ) : !(
                      contractState.value.loanRepaymentAddress ||
                      contractState.value.btcLoanRepaymentAddress
                    ) ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-700">
                        No repayment address available for this contract.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        Send the repayment directly from your connected wallet.
                      </p>

                      {repaymentSuccess && (
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
                                Repayment Transaction Sent Successfully!
                              </h4>
                              <p className="text-sm text-green-700 mt-1 break-all">
                                Transaction ID: {repaymentSuccess}
                              </p>
                              <a
                                href={`https://mempool.space/tx/${repaymentSuccess}`}
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

                      {repaymentError && (
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
                                Repayment Failed
                              </h4>
                              <p className="text-sm text-red-700 mt-1">
                                {repaymentError}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleRepayWithWallet}
                        disabled={
                          isRepaying ||
                          !(
                            contractState.value.loanRepaymentAddress ||
                            contractState.value.btcLoanRepaymentAddress
                          )
                        }
                        className="w-full"
                      >
                        {isRepaying ? (
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
                            Sending Repayment...
                          </>
                        ) : (
                          `Repay Loan ($${contractState.value.balanceOutstanding.toFixed(2)})`
                        )}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* External Wallet Tab */}
              {activeTab === "external" && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Submit External Repayment
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    If you've already sent the repayment from an external
                    wallet, enter the transaction ID below to mark the loan as
                    repaid.
                  </p>

                  {submitSuccess && (
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
                        <div>
                          <h4 className="text-sm font-medium text-green-800">
                            Repayment Recorded Successfully!
                          </h4>
                          <p className="text-sm text-green-700 mt-1">
                            Your repayment has been submitted and is being
                            verified.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {submitError && (
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
                            Submission Failed
                          </h4>
                          <p className="text-sm text-red-700 mt-1">
                            {submitError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="txid"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Transaction ID
                      </label>
                      <input
                        type="text"
                        id="txid"
                        value={txidInput}
                        onChange={(e) => setTxidInput(e.target.value)}
                        placeholder="Enter transaction ID..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isSubmitting}
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        The transaction ID (txid) from your repayment
                        transaction
                      </p>
                    </div>

                    <Button
                      onClick={handleSubmitExternalRepayment}
                      disabled={isSubmitting || !txidInput.trim()}
                      className="w-full"
                    >
                      {isSubmitting ? (
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
                          Submitting...
                        </>
                      ) : (
                        "Submit Repayment"
                      )}
                    </Button>
                  </div>
                </div>
              )}
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
