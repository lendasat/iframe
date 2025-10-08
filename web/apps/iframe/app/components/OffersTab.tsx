import { useAsync } from "react-use";
import { useState, useMemo } from "react";
import { apiClient } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";

interface OffersTabProps {
  user: { email: string; username: string } | null;
}

export function OffersTab({ user }: OffersTabProps) {
  const [amountFilter, setAmountFilter] = useState<string>("");
  const [durationFilter, setDurationFilter] = useState<string>("");
  const [assetFilter, setAssetFilter] = useState<string>("all");

  // Fetch offers
  const offersState = useAsync(async () => {
    if (!user) return null;
    return await apiClient.offers();
  }, [user]);

  // Get unique loan assets for dropdown
  const availableAssets = useMemo(() => {
    if (!offersState.value) return [];
    const assets = new Set(offersState.value.map((offer) => offer.loanAsset));
    return Array.from(assets).sort();
  }, [offersState.value]);

  // Filter offers
  const filteredOffers = useMemo(() => {
    if (!offersState.value) return null;

    return offersState.value.filter((offer) => {
      // Filter by amount
      if (amountFilter) {
        const amount = parseFloat(amountFilter);
        if (!isNaN(amount) && (amount < offer.loanAmountMin || amount > offer.loanAmountMax)) {
          return false;
        }
      }

      // Filter by duration
      if (durationFilter) {
        const duration = parseInt(durationFilter);
        if (!isNaN(duration) && (duration < offer.durationDaysMin || duration > offer.durationDaysMax)) {
          return false;
        }
      }

      // Filter by asset
      if (assetFilter !== "all" && offer.loanAsset !== assetFilter) {
        return false;
      }

      return true;
    });
  }, [offersState.value, amountFilter, durationFilter, assetFilter]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Available Offers
      </h2>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="amount-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Loan Amount
            </label>
            <input
              id="amount-filter"
              type="number"
              placeholder="Enter amount"
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="duration-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Duration (days)
            </label>
            <input
              id="duration-filter"
              type="number"
              placeholder="Enter duration"
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="asset-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Loan Asset
            </label>
            <select
              id="asset-filter"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Assets</option>
              {availableAssets.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {offersState.loading && <LoadingOverlay message="Loading offers..." />}
      {offersState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading offers: {offersState.error.message}
        </div>
      )}
      {filteredOffers && filteredOffers.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No offers match the selected filters.</p>
        </div>
      )}
      {filteredOffers && filteredOffers.length > 0 && (
        <div className="space-y-4">
          {filteredOffers.map((offer) => (
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
