import {
  LoanOfferStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { formatCurrency, LoanAssetHelper, ONE_YEAR } from "@frontend/ui-shared";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAsync } from "react-use";
import { FaPenNib } from "react-icons/fa";
import { MdOutlineSwapCalls } from "react-icons/md";
import { AlertTriangle } from "lucide-react";
import ReceipImg from "./../../assets/receipt_img.png";
import { Button } from "@frontend/shadcn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Checkbox } from "@frontend/shadcn";
import { Separator } from "@frontend/shadcn";
import { ScrollArea } from "@frontend/shadcn";
import { Card, CardContent } from "@frontend/shadcn";

function MyLoanOfferDetails() {
  const { getMyLoanOffer, deleteLoanOffer } = useLenderHttpClient();
  const { id } = useParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { value: offer, error: loadingError } = useAsync(async () => {
    if (id) {
      return getMyLoanOffer(id);
    } else {
      return undefined;
    }
  }, [id]);

  if (loadingError || !offer) {
    return (
      <div className="flex h-[calc(100vh-130px)] flex-col items-center justify-center gap-y-4 px-5 text-center">
        <div className="flex h-52 w-52 items-center justify-center overflow-hidden rounded-full bg-background">
          <img src={ReceipImg} alt="error card" className="max-w-52" />
        </div>
        <p className="text-sm text-muted-foreground">
          An Error Occurred... {JSON.stringify(loadingError) || ""}
        </p>
      </div>
    );
  }

  const onDeleteOffer = async (id: string) => {
    setLoading(true);
    try {
      await deleteLoanOffer(id);
      setIsDialogOpen(false);
      navigate(0);
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loanAsset = offer.loan_asset;
  const coinLabel = LoanAssetHelper.print(loanAsset);

  return (
    <ScrollArea className="h-[calc(100vh-130px)]">
      <div className="container mx-auto max-w-3xl py-8">
        <Card className="border-border/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FaPenNib className="text-foreground" />
              <h2 className="text-xl font-bold">Loan Details</h2>
            </div>

            <div className="space-y-5">
              {/* Amount */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">Amount</Label>
                <div className="flex items-center gap-4">
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Min Amount"
                    value={formatCurrency(offer.loan_amount_min)}
                    disabled={true}
                  />

                  <MdOutlineSwapCalls className="text-muted-foreground" />

                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Max Amount"
                    value={formatCurrency(offer.loan_amount_max)}
                    disabled={true}
                  />
                </div>
              </div>

              {/* Reserve */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  Loan Amount Reserve
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Loan Reserve"
                    value={formatCurrency(offer.loan_amount_reserve)}
                    disabled={true}
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    ({formatCurrency(offer.loan_amount_reserve_remaining)}{" "}
                    remaining)
                  </span>
                </div>
              </div>

              {/* Auto Accept */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-accept"
                    checked={offer.auto_accept}
                    disabled={true}
                  />
                  <Label
                    htmlFor="auto-accept"
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Auto accept requests within Loan Reserve
                  </Label>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-muted-foreground">Duration</Label>
                  <span className="text-xs font-medium text-muted-foreground/50">
                    (days)
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Min Duration"
                    value={offer.duration_days_min}
                    disabled={true}
                  />

                  <MdOutlineSwapCalls className="text-muted-foreground" />

                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Max Duration"
                    value={offer.duration_days_max}
                    disabled={true}
                  />
                </div>
              </div>

              {/* Interest Rate */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">Interest Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Interest Rate"
                    value={(offer.interest_rate * 100).toFixed(2)}
                    disabled={true}
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    1 - 100
                  </span>
                </div>
              </div>

              {/* Extensions */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">Loan Extension</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="Extension duration"
                    value={
                      offer.extension_max_duration_days > 0
                        ? offer.extension_max_duration_days
                        : "Disabled"
                    }
                    disabled={true}
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    1 - {ONE_YEAR}
                  </span>
                </div>
              </div>

              {/* Extensions */}
              {offer.extension_interest_rate && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">
                    Loan Extension Interest
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1 rounded-lg text-sm"
                      type="text"
                      placeholder="Extension interest"
                      value={(offer.extension_interest_rate * 100).toFixed(2)}
                      disabled={true}
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      1 - {ONE_YEAR}
                    </span>
                  </div>
                </div>
              )}

              {/* LTV */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  Loan to Value (LTV)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    placeholder="LTV (1-100)"
                    value={(offer.min_ltv * 100).toFixed(2)}
                    disabled={true}
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    1% - 70%
                  </span>
                </div>
              </div>

              {/* Coin */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">Coin</Label>
                <Input
                  className="flex-1 rounded-lg text-sm"
                  type="text"
                  value={coinLabel}
                  disabled={true}
                />
              </div>

              {/* KYC Link */}
              {offer.kyc_link && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">KYC Link</Label>
                  <Input
                    className="flex-1 rounded-lg text-sm"
                    type="text"
                    value={offer.kyc_link}
                    disabled={true}
                  />
                </div>
              )}

              <Separator className="my-6" />

              {/* Dates and Action Buttons */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Created on:
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(offer.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Last Edited:
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(offer.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Retract Offer Button */}
                {offer.status !== LoanOfferStatus.Deleted && (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className={"px-4"}>
                        Retract Offer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Retract Offer</DialogTitle>
                        <DialogDescription>
                          Please confirm the retraction of this offer.
                        </DialogDescription>
                      </DialogHeader>

                      {error && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => onDeleteOffer(offer.id)}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2"></span>
                              Retracting...
                            </>
                          ) : (
                            "Retract"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default MyLoanOfferDetails;
