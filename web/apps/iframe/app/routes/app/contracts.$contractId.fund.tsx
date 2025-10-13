import { useParams, useNavigate } from "react-router";
import { useAsync } from "react-use";
import type { Route } from "../+types/app.contracts.$contractId.fund";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Fund Contract - Lendasat" },
    { name: "description", content: "Fund your contract" },
  ];
}

export default function FundContract() {
  const { contractId } = useParams();
  const navigate = useNavigate();

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

              {/* Contract Address */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Contract Address</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {contractState.value.contractAddress ||
                    "Contract address not yet available"}
                </p>
                {contractState.value.contractAddress && (
                  <a
                    href={`https://mempool.space/address/${contractState.value.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-2 inline-block"
                  >
                    View on Mempool →
                  </a>
                )}
              </div>

              {/* Required Collateral Amount */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Required Collateral Amount
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {contractState.value.collateralSats.toLocaleString()} sats
                </p>
                <p className="text-sm text-gray-500">
                  {(contractState.value.collateralSats / 100_000_000).toFixed(
                    8,
                  )}{" "}
                  BTC
                </p>
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
                    <span className="text-blue-700">Interest Rate:</span>
                    <span className="font-medium text-blue-900">
                      {(contractState.value.interestRate * 100).toFixed(2)}%
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
                      Please ensure you send the exact collateral amount to the
                      contract address. The loan will be disbursed once the
                      collateral is confirmed on the blockchain.
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
