import { useState } from "react";
import { useNavigate, useSearchParams, useParams, useOutletContext } from "react-router";
import { useAsync } from "react-use";
import type { Route } from "../+types/app.offers.$offerId";
import { apiClient, formatLoanAsset } from "@repo/api";
import { LoadingOverlay } from "~/components/ui/spinner";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Take Offer - Lendasat" },
    { name: "description", content: "Complete your loan application" },
  ];
}

export default function TakeOffer() {
  const navigate = useNavigate();
  const { offerId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useOutletContext<{
    user: { email: string; username: string };
  }>();

  // Get URL parameters for pre-filled values
  const suggestedAmount = searchParams.get("amount");
  const suggestedDuration = searchParams.get("duration");

  // Form state
  const [amount, setAmount] = useState(suggestedAmount || "");
  const [duration, setDuration] = useState(suggestedDuration || "");
  const [collateralAmount, setCollateralAmount] = useState("");

  // Fetch the specific offer
  const offerState = useAsync(async () => {
    if (!offerId) return null;
    const offers = await apiClient.offers();
    return offers.find((offer) => offer.id === offerId);
  }, [offerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement the actual submission logic
    console.log("Taking offer with:", {
      offerId,
      amount,
      duration,
      collateralAmount,
    });
  };

  if (!offerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600">Invalid offer ID</p>
          <button
            onClick={() => navigate("/app/offers")}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Offers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/app/offers")}
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
          Back to Offers
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Take Offer</h1>
      </div>

      {offerState.loading && (
        <LoadingOverlay message="Loading offer details..." />
      )}

      {offerState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading offer: {offerState.error.message}
        </div>
      )}

      {offerState.value && (
        <div className="space-y-6">
          {/* Offer Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {formatLoanAsset(offerState.value.loanAsset)} offer by{" "}
              {offerState.value.lender.name}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Amount Range</p>
                <p className="font-medium">
                  {offerState.value.loanAmountMin} -{" "}
                  {offerState.value.loanAmountMax}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Interest Rate</p>
                <p className="font-medium">
                  {(offerState.value.interestRate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500">Duration Range</p>
                <p className="font-medium">
                  {offerState.value.durationDaysMin} -{" "}
                  {offerState.value.durationDaysMax} days
                </p>
              </div>
              <div>
                <p className="text-gray-500">Min LTV</p>
                <p className="font-medium">
                  {(offerState.value.minLtv * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* Application Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Loan Details
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Loan Amount *
                </label>
                <input
                  id="amount"
                  type="number"
                  required
                  min={offerState.value.loanAmountMin}
                  max={offerState.value.loanAmountMax}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Enter amount (${offerState.value.loanAmountMin} - ${offerState.value.loanAmountMax})`}
                />
              </div>

              <div>
                <label
                  htmlFor="duration"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Duration (days) *
                </label>
                <input
                  id="duration"
                  type="number"
                  required
                  min={offerState.value.durationDaysMin}
                  max={offerState.value.durationDaysMax}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Enter duration (${offerState.value.durationDaysMin} - ${offerState.value.durationDaysMax} days)`}
                />
              </div>

              <div>
                <label
                  htmlFor="collateral"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Collateral Amount (BTC) *
                </label>
                <input
                  id="collateral"
                  type="number"
                  step="0.00000001"
                  required
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter collateral amount in BTC"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => navigate("/app/offers")}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Submit Application
              </button>
            </div>
          </form>
        </div>
      )}

      {!offerState.loading && !offerState.value && !offerState.error && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Offer not found</p>
          <button
            onClick={() => navigate("/app/offers")}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Offers
          </button>
        </div>
      )}
    </div>
  );
}
