import { useAsync } from "react-use";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";

interface OffersTabProps {
  user: { email: string; username: string } | null;
}

export function OffersTab({ user }: OffersTabProps) {
  // Fetch offers
  const offersState = useAsync(async () => {
    if (!user) return null;
    return await apiClient.offers();
  }, [user]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Available Offers
      </h2>
      {offersState.loading && <LoadingOverlay message="Loading offers..." />}
      {offersState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading offers: {offersState.error.message}
        </div>
      )}
      {offersState.value && offersState.value.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No offers available.</p>
        </div>
      )}
      {offersState.value && offersState.value.length > 0 && (
        <div className="space-y-4">
          {offersState.value.map((offer) => (
            <div key={offer.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {offer.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    ID: {offer.id.substring(0, 8)}...
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    offer.status === "Available"
                      ? "bg-green-100 text-green-800"
                      : offer.status === "Unavailable"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {offer.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Loan Amount</p>
                  <p className="font-medium">
                    {offer.loanAmountMin} - {offer.loanAmountMax}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Interest Rate</p>
                  <p className="font-medium">
                    {(offer.interestRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Duration</p>
                  <p className="font-medium">
                    {offer.durationDaysMin} - {offer.durationDaysMax} days
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Min LTV</p>
                  <p className="font-medium">
                    {(offer.minLtv * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Payout</p>
                  <p className="font-medium">{offer.loanPayout}</p>
                </div>
                {offer.kycLink && (
                  <div>
                    <p className="text-gray-600">KYC</p>
                    <a
                      href={offer.kycLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Required
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
