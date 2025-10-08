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
        <div className="space-y-3">
          {filteredOffers.map((offer) => (
            <div key={offer.id} className="bg-white rounded-lg shadow p-4">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                  {offer.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {offer.id.substring(0, 8)}...
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Amount</p>
                  <p className="font-medium">
                    {offer.loanAmountMin} - {offer.loanAmountMax}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Interest Rate</p>
                  <p className="font-medium">
                    {(offer.interestRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Duration</p>
                  <p className="font-medium">
                    {offer.durationDaysMin} - {offer.durationDaysMax} days
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Min LTV</p>
                  <p className="font-medium">
                    {(offer.minLtv * 100).toFixed(0)}%
                  </p>
                </div>
                {offer.kycLink && (
                  <div>
                    <p className="text-gray-500 text-xs">KYC</p>
                    <a
                      href={offer.kycLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
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
