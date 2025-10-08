import { useAsync } from "react-use";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";

interface ApplicationsTabProps {
  user: { email: string; username: string } | null;
}

export function ApplicationsTab({ user }: ApplicationsTabProps) {
  // Fetch loan applications
  const applicationsState = useAsync(async () => {
    if (!user) return null;
    return await apiClient.myApplications();
  }, [user]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        My Applications
      </h2>
      {applicationsState.loading && (
        <LoadingOverlay message="Loading applications..." />
      )}
      {applicationsState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading applications: {applicationsState.error.message}
        </div>
      )}
      {applicationsState.value && applicationsState.value.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No loan applications found.</p>
        </div>
      )}
      {applicationsState.value && applicationsState.value.length > 0 && (
        <div className="space-y-4">
          {applicationsState.value.map((application) => (
            <div
              key={application.loanDealId}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {application.loanType}
                  </h3>
                  <p className="text-sm text-gray-600">
                    ID: {application.loanDealId.substring(0, 8)}...
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    application.status === "Available"
                      ? "bg-green-100 text-green-800"
                      : application.status === "Unavailable"
                      ? "bg-yellow-100 text-yellow-800"
                      : application.status === "Taken"
                      ? "bg-blue-100 text-blue-800"
                      : application.status === "Deleted"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {application.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Loan Amount</p>
                  <p className="font-medium">
                    {application.loanAmountMin} - {application.loanAmountMax}{" "}
                    {application.loanAsset}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Interest Rate</p>
                  <p className="font-medium">
                    {(application.interestRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Duration</p>
                  <p className="font-medium">
                    {application.durationDaysMin} - {application.durationDaysMax}{" "}
                    days
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">LTV</p>
                  <p className="font-medium">
                    {(application.ltv * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Loan Asset</p>
                  <p className="font-medium">{application.loanAsset}</p>
                </div>
                <div>
                  <p className="text-gray-600">Repayment Plan</p>
                  <p className="font-medium">
                    {application.repaymentPlan.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600">Created</p>
                  <p className="font-medium">
                    {application.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
