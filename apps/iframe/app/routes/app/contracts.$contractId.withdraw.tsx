import { useParams, useNavigate } from "react-router";
import { useAsyncRetry } from "react-use";
import { useState, useEffect } from "react";
import type { Route } from "../+types/app.contracts.$contractId.withdraw";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "~/hooks/useWallet";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Withdraw Collateral - Lendasat" },
    { name: "description", content: "Withdraw your Bitcoin collateral" },
  ];
}

export default function WithdrawCollateral() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { client, isConnected } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmountSats, setCopiedAmountSats] = useState(false);
  const [copiedAmountBtc, setCopiedAmountBtc] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState<string>("1");
  const [contract, setContract] = useState<any>(null);

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

  const handleWithdrawWithWallet = async () => {
    if (!client || !displayContract) {
      return;
    }

    const feeRateNum = parseFloat(feeRate);
    if (isNaN(feeRateNum) || feeRateNum <= 0) {
      setWithdrawError("Please enter a valid fee rate");
      return;
    }

    try {
      setIsWithdrawing(true);
      setWithdrawError(null);
      setWithdrawSuccess(null);

      // Step 1: Get the PSBT from the API
      console.log("Getting claim PSBT with fee rate:", feeRateNum);
      const { psbt, collateral_descriptor, borrower_pk } =
        await apiClient.getClaimPsbt(displayContract.id, feeRateNum);

      console.log("Received PSBT details:", {
        collateral_descriptor,
        borrower_pk,
      });

      // Step 2: Sign the PSBT using the wallet bridge
      console.log("Signing PSBT with wallet...");
      const signedPsbt = await client.signPsbt(
        psbt,
        collateral_descriptor,
        borrower_pk,
      );

      // Step 3: Broadcast the signed transaction
      console.log("Broadcasting signed transaction...");
      const { txid } = await apiClient.broadcastClaimPsbt(
        displayContract.id,
        signedPsbt,
      );

      setWithdrawSuccess(txid);
      console.log("Collateral withdrawal successful:", txid);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setWithdrawError(errorMessage);
      console.error("Failed to withdraw collateral:", err);
    } finally {
      setIsWithdrawing(false);
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
        <h1 className="text-2xl font-bold text-gray-900">
          Withdraw Collateral
        </h1>
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
          {/* Withdrawal Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Withdrawal Instructions
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Your loan has been fully repaid and confirmed. You can now
                  withdraw your Bitcoin collateral from the contract address.
                </p>
              </div>

              {/* Your Bitcoin Address */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Your funds will be returned to:
                </p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {displayContract.borrowerBtcAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Withdrawal Options */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Withdraw Collateral
            </h2>

            {!isConnected ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  No wallet connected. Please use an external wallet to withdraw
                  your collateral from the contract address.
                </p>
              </div>
            ) : !displayContract.contractAddress ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  No contract address available.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Withdraw your Bitcoin collateral from the contract back to
                  your address.
                </p>

                {/* Fee Rate Input */}
                <div className="mb-4">
                  <label
                    htmlFor="feeRate"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Transaction Fee Rate (sats/vbyte)
                  </label>
                  <input
                    type="number"
                    id="feeRate"
                    value={feeRate}
                    onChange={(e) => setFeeRate(e.target.value)}
                    placeholder="Enter fee rate..."
                    min="1"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isWithdrawing}
                  />
                </div>

                {withdrawSuccess && (
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
                          Withdrawal Transaction Sent Successfully!
                        </h4>
                        <p className="text-sm text-green-700 mt-1 break-all">
                          Transaction ID: {withdrawSuccess}
                        </p>
                        <a
                          href={`https://mempool.space/tx/${withdrawSuccess}`}
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

                {withdrawError && (
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
                          Withdrawal Failed
                        </h4>
                        <p className="text-sm text-red-700 mt-1">
                          {withdrawError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleWithdrawWithWallet}
                  disabled={
                    isWithdrawing ||
                    !displayContract.contractAddress ||
                    !feeRate ||
                    parseFloat(feeRate) <= 0
                  }
                  className="w-full"
                >
                  {isWithdrawing ? (
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
                      Withdrawing Collateral...
                    </>
                  ) : (
                    `Withdraw ${displayContract.collateralSats.toLocaleString()} sats`
                  )}
                </Button>
              </>
            )}
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
