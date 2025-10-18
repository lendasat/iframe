import { useParams, useNavigate } from "react-router";
import { useAsyncRetry } from "react-use";
import { useState, useEffect } from "react";
import type { Route } from "../+types/app.contracts.$contractId.recover";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import { useWallet } from "~/hooks/useWallet";
import * as bitcoin from "bitcoinjs-lib";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Recover Collateral - Lendasat" },
    { name: "description", content: "Recover your Bitcoin collateral" },
  ];
}

export default function RecoverCollateral() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { client, isConnected } = useWallet();
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recoverSuccess, setRecoverSuccess] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState<string>("1");
  const [contract, setContract] = useState<any>(null);
  const [disableRecoverButton, setDisableRecoverButton] = useState(false);

  const handleRecoverWithWallet = async () => {
    if (!client || !displayContract) {
      return;
    }

    const feeRateNum = parseFloat(feeRate);
    if (isNaN(feeRateNum) || feeRateNum <= 0) {
      setRecoverError("Please enter a valid fee rate");
      return;
    }

    try {
      setIsRecovering(true);
      setRecoverError(null);
      setRecoverSuccess(null);
      setDisableRecoverButton(false);

      // Step 1: Get the PSBT from the API
      console.log("Getting recovery PSBT with fee rate:", feeRateNum);
      const { psbt, collateral_descriptor, borrower_pk } =
        await apiClient.getRecoverPsbt(displayContract.id, feeRateNum);

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

      const psbtObj = bitcoin.Psbt.fromHex(signedPsbt);
      const finalizedPsbt = psbtObj.finalizeAllInputs();

      // Step 3: Broadcast the signed transaction
      console.log("Broadcasting signed transaction...");
      const { txid } = await apiClient.broadcastRecoverTx(
        displayContract.id,
        finalizedPsbt.extractTransaction().toHex(),
      );

      setRecoverSuccess(txid);
      setDisableRecoverButton(true);
      console.log("Collateral recovery successful:", txid);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setRecoverError(errorMessage);
      console.error("Failed to recover collateral:", err);
    } finally {
      setIsRecovering(false);
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
        <Button
          onClick={() => navigate(`/app/contracts/${contractId}`)}
          className="mt-4"
          variant="outline"
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
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Recover Collateral</h1>
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
          {/* Recovery Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Recovery Instructions
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  This contract is in a recoverable state. You can recover your
                  Bitcoin collateral from the contract address.
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

              {/* Warning about recoverable status */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0"
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
                    <h4 className="text-sm font-medium text-amber-800">
                      Contract is Recoverable
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      The collateral recovery timelock has expired. You can now
                      recover your Bitcoin collateral.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recovery Options */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Recover Collateral
            </h2>

            {!isConnected ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  No wallet connected. Please connect your wallet to recover
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
                  Recover your Bitcoin collateral from the contract back to your
                  address.
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
                    disabled={isRecovering}
                  />
                </div>

                {recoverSuccess && (
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
                          Recovery Transaction Sent Successfully!
                        </h4>
                        <p className="text-sm text-green-700 mt-1 break-all">
                          Transaction ID: {recoverSuccess}
                        </p>
                        <a
                          href={`https://mempool.space/tx/${recoverSuccess}`}
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

                {recoverError && (
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
                          Recovery Failed
                        </h4>
                        <p className="text-sm text-red-700 mt-1">
                          {recoverError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleRecoverWithWallet}
                  disabled={
                    disableRecoverButton ||
                    isRecovering ||
                    !displayContract.contractAddress ||
                    !feeRate ||
                    parseFloat(feeRate) <= 0
                  }
                  className="w-full"
                >
                  {isRecovering ? (
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
                      Recovering Collateral...
                    </>
                  ) : (
                    `Recover ${displayContract.collateralSats.toLocaleString()} sats`
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
              disabled={!disableRecoverButton}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
