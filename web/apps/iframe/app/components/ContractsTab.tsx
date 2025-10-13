import { useAsync } from "react-use";
import { useNavigate } from "react-router";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";

interface ContractsTabProps {
  user: { email: string; username: string } | null;
}

export function ContractsTab({ user }: ContractsTabProps) {
  const navigate = useNavigate();

  // Fetch contracts
  const contractsState = useAsync(async () => {
    if (!user) return null;
    return await apiClient.contracts();
  }, [user]);

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
        <div className="space-y-4">
          {contractsState.value.data.map((contract) => (
            <div key={contract.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Contract {contract.id.substring(0, 8)}...
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                <div>
                  <p className="text-gray-600">Loan Amount</p>
                  <p className="font-medium">
                    ${contract.loanAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Collateral</p>
                  <p className="font-medium">{contract.collateralSats.toLocaleString()} sats</p>
                </div>
                <div>
                  <p className="text-gray-600">Interest Rate</p>
                  <p className="font-medium">
                    {(contract.interestRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Duration</p>
                  <p className="font-medium">{contract.durationDays} days</p>
                </div>
                <div>
                  <p className="text-gray-600">Expiry</p>
                  <p className="font-medium">
                    {contract.expiry.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/app/contracts/${contract.id}`)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors"
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
