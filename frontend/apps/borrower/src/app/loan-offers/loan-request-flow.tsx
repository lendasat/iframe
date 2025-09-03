import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { Filter, Search } from "lucide-react";
import { useAsync } from "react-use";
import {
  LoanOffer,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { toast } from "sonner";
import { LoanAsset, LoanAssetHelper } from "@frontend/ui-shared";
import { OffersSelectionTable } from "./offer-selection/offers-selection-new";
import { useNavigate } from "react-router-dom";

export enum LoanProductTypes {
  Any = "any",
  PayWithMoon = "pay_with_moon",
  StableCoins = "stable_coins",
  Fiat = "fiat",
  Bringin = "bringin",
}

export const LoanRequestFlow = () => {
  const { getDirectLoanOffers } = useHttpClientBorrower();
  const navigate = useNavigate();

  const [amount, setAmount] = useState<string | undefined>();
  const [paymentOption, setPaymentOption] = useState<
    LoanProductTypes | undefined
  >(LoanProductTypes.Any);
  const [duration, setDuration] = useState<string | undefined>();
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | undefined>();

  const {
    loading,
    value: maybeAvailableOffers,
    error: loadingError,
  } = useAsync(async () => {
    return getDirectLoanOffers();
  }, []);

  if (loadingError) {
    // TODO: handle error
    console.error(`Failed fetching loan offers ${loadingError}`);
    toast.error(`Failed fetching loan offers ${loadingError}`);
  }
  const filteredOffers = (maybeAvailableOffers || []).filter((offer) => {
    if (amount) {
      const amountNumber = Number.parseFloat(amount);
      if (
        offer.loan_amount_min > amountNumber ||
        offer.loan_amount_max < amountNumber
      ) {
        return false;
      }
    }
    if (duration) {
      const durationNumber = Number.parseFloat(duration);
      if (
        offer.duration_days_min > durationNumber ||
        offer.duration_days_max < durationNumber
      ) {
        return false;
      }
    }
    if (paymentOption) {
      switch (paymentOption) {
        case LoanProductTypes.Any:
          break;
        case LoanProductTypes.PayWithMoon:
        case LoanProductTypes.Bringin:
          if (offer.loan_asset !== LoanAsset.USDC_POL) {
            return false;
          }
          break;
        case LoanProductTypes.StableCoins:
          if (!LoanAssetHelper.isStableCoin(offer.loan_asset)) {
            return false;
          }
          break;
        case LoanProductTypes.Fiat:
          if (!LoanAssetHelper.isFiat(offer.loan_asset)) {
            return false;
          }
          break;
      }
    }

    return true;
  });

  return (
    <div className="bg-background min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Loan Request Form */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Loan Requirements
            </CardTitle>
            <CardDescription>
              Enter your loan requirements to find matching offers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Loan Amount</Label>
                <Input
                  id="amount"
                  type="text"
                  placeholder="Enter max amount to borrow"
                  value={amount}
                  onChange={(e) => {
                    if (
                      e.target.value.trim().length === 0 ||
                      Number.isNaN(e.target.value)
                    ) {
                      setAmount("");
                    } else {
                      setAmount(e.target.value);
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (Days)</Label>
                <Input
                  id="duration"
                  type="text"
                  placeholder="Enter min duration to borrow"
                  value={duration}
                  onChange={(e) => {
                    if (
                      e.target.value.trim().length === 0 ||
                      Number.isNaN(e.target.value)
                    ) {
                      setDuration("");
                    } else {
                      setDuration(e.target.value);
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method">Loan Asset</Label>
                <Select
                  value={paymentOption || ""}
                  onValueChange={(value) =>
                    setPaymentOption(value as LoanProductTypes)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LoanProductTypes.Any}>All</SelectItem>
                    <SelectItem value={LoanProductTypes.Fiat}>
                      EUR/CHF/USD
                    </SelectItem>
                    <SelectItem value={LoanProductTypes.StableCoins}>
                      USDC/USDT
                    </SelectItem>
                    {/*// TODO: disable Bringin if feature is not available*/}
                    <SelectItem value={LoanProductTypes.Bringin}>
                      Bringin
                    </SelectItem>
                    <SelectItem value={LoanProductTypes.PayWithMoon}>
                      Credit Card
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loan Asset Information */}
            {paymentOption && (
              <div className="bg-muted/30 col-span-full mt-4 rounded-lg p-4">
                <div className="text-sm">
                  {paymentOption === LoanProductTypes.Any && (
                    <p>
                      Multiple loan assets available including EUR, CHF, USD
                      fiat currencies and USDC/USDT stablecoins on various
                      networks.
                    </p>
                  )}
                  {paymentOption === LoanProductTypes.Fiat && (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">
                          Fiat Currency Loans:
                        </span>{" "}
                        Receive EUR, CHF, or USD directly to your bank account.
                      </p>
                      <p className="text-muted-foreground">
                        • Requires banking details
                        <br />• Direct bank transfer to your account
                        <br />• Processing time: 1-3 business days
                      </p>
                    </div>
                  )}
                  {paymentOption === LoanProductTypes.StableCoins && (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">Stablecoin Loans:</span>{" "}
                        Receive USDC or USDT on supported blockchain networks.
                      </p>
                      <p className="text-muted-foreground">
                        • Available on Ethereum, Polygon, Solana, and more
                        <br />• Provide an address you control
                      </p>
                    </div>
                  )}
                  {paymentOption === LoanProductTypes.PayWithMoon && (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">Credit Card Top-up:</span>{" "}
                        Load funds directly to a virtual credit card.
                      </p>
                      <p className="text-muted-foreground">
                        • Create a new card or top up existing Moon card
                        <br />• Use anywhere Visa/Mastercard is accepted
                        <br />• 1% or minimum $1 fee per transaction
                      </p>
                    </div>
                  )}
                  {paymentOption === LoanProductTypes.Bringin && (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">
                          Bringin Integration:
                        </span>{" "}
                        Seamless crypto-to-fiat conversion via Bringin.
                      </p>
                      <p className="text-muted-foreground">
                        • Requires Bringin API key connection
                        <br />• Repay using USDC on Polygon
                        <br />• Direct conversion to EUR
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Options */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Available Loan Offers
              <Badge variant="secondary" className="ml-auto">
                {filteredOffers.length} matches
              </Badge>
            </CardTitle>
            <CardDescription>
              {filteredOffers.length === 0
                ? "No options match your criteria. Try adjusting your requirements or create a custom application below."
                : "Select a loan option that matches your requirements"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredOffers.length > 0 ? (
              <div className="overflow-x-auto">
                <OffersSelectionTable
                  availableOffers={filteredOffers}
                  onOfferSelect={(selectedOffer) => {
                    if (selectedOffer) {
                      // Navigate to details page with query parameters
                      const queryParams = new URLSearchParams();

                      // Use current amount or default to offer's min
                      const loanAmount =
                        amount || selectedOffer.loan_amount_min.toString();
                      queryParams.set("amount", loanAmount);

                      // Use current duration or default to offer's min
                      const loanDuration =
                        duration || selectedOffer.duration_days_min.toString();
                      queryParams.set("duration", loanDuration);

                      // Add payment type
                      if (paymentOption) {
                        queryParams.set("paymentType", paymentOption);
                      }

                      navigate(
                        `/loan-offers/${selectedOffer.id}/configure?${queryParams.toString()}`,
                      );
                    } else {
                      setSelectedOffer(undefined);
                    }
                  }}
                  selectedOffer={selectedOffer}
                  loadingError={loadingError}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="space-y-4 py-8 text-center">
                <p className="text-muted-foreground">
                  No matching loan options found
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const queryParams = new URLSearchParams();
                    if (amount) queryParams.set("amount", amount);
                    if (duration) queryParams.set("duration", duration);
                    if (paymentOption)
                      queryParams.set("loanAsset", paymentOption);
                    navigate(`/loan-application?${queryParams.toString()}`);
                  }}
                >
                  Create Custom Loan Application
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
