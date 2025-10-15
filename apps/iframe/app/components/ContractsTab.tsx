import { useAsync } from "react-use";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { apiClient, type Contract, type ContractStatus } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";

interface ContractsTabProps {
  user: { email: string; username: string } | null;
}

// Helper function to get sorting priority for contract statuses
function getStatusPriority(status: ContractStatus): number {
  // Requested contracts (highest priority)
  switch (status) {
    case "Requested":
    case "Approved":
    case "RepaymentConfirmed":
    case "CollateralRecoverable":
      return 1;
    case "CollateralSeen":
    case "CollateralConfirmed":
    case "PrincipalGiven":
    case "RepaymentProvided":
    case "Undercollateralized":
    case "DisputeBorrowerStarted":
    case "DisputeLenderStarted":
      return 2;
    case "ClosingByClaim":
    case "Defaulted":
    case "Closed":
    case "Closing":
    case "ClosingByLiquidation":
    case "ClosedByLiquidation":
    case "ClosingByDefaulting":
    case "ClosedByDefaulting":
    case "Extended":
    case "Rejected":
    case "Cancelled":
    case "RequestExpired":
    case "ApprovalExpired":
    case "ClosingByRecovery":
    case "ClosedByRecovery":
      return 3;
  }
}

// Sort contracts by status priority, then by creation date
function sortContracts(contracts: Contract[]): Contract[] {
  return [...contracts].sort((a, b) => {
    const priorityDiff =
      getStatusPriority(a.status) - getStatusPriority(b.status);
    if (priorityDiff !== 0) return priorityDiff;

    // Within same priority group, sort by creation date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

// Check if a contract is closed
function isContractClosed(status: ContractStatus): boolean {
  return getStatusPriority(status) === 3;
}

export function ContractsTab({ user }: ContractsTabProps) {
  const navigate = useNavigate();

  // Fetch contracts
  const contractsState = useAsync(async () => {
    if (!user) return null;
    return await apiClient.contracts();
  }, [user]);

  // Redirect to offers tab if no contracts exist
  useEffect(() => {
    if (contractsState.value && contractsState.value.data.length === 0) {
      navigate("/app/offers");
    }
  }, [contractsState.value, navigate]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Contracts</h2>
      {contractsState.loading && (
        <LoadingOverlay message="Loading contracts..." />
      )}
      {contractsState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading contracts: {contractsState.error.message}
        </div>
      )}
      {contractsState.value && contractsState.value.data.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No contracts found.</p>
        </div>
      )}
      {contractsState.value && contractsState.value.data.length > 0 && (
        <div className="space-y-3">
          {sortContracts(contractsState.value.data).map((contract) => (
            <div key={contract.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Contract {contract.id.substring(0, 8)}...
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    contract.status === "PrincipalGiven"
                      ? "bg-green-100 text-green-800"
                      : contract.status === "Requested"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {contract.status}
                </span>
              </div>
              <div
                className={`grid gap-3 text-sm mb-3 ${
                  isContractClosed(contract.status)
                    ? "grid-cols-2 md:grid-cols-3"
                    : "grid-cols-2 md:grid-cols-4"
                }`}
              >
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Loan Amount</p>
                  <p className="font-medium text-gray-900">
                    $
                    {contract.loanAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Interest Rate</p>
                  <p className="font-medium text-gray-900">
                    {(contract.interestRate * 100).toFixed(1)}%
                  </p>
                </div>
                {!isContractClosed(contract.status) && (
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Collateral</p>
                    <p className="font-medium text-gray-900">
                      {contract.collateralSats.toLocaleString()} sats
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">
                    {isContractClosed(contract.status) ? "Closed" : "Expiry"}
                  </p>
                  <p className="font-medium text-gray-900">
                    {isContractClosed(contract.status)
                      ? contract.updatedAt.toLocaleDateString()
                      : contract.expiry.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/app/contracts/${contract.id}`)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
