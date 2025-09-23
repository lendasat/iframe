import { useState, ReactNode, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAsync } from "react-use";
import { useWallet } from "@frontend/browser-wallet";
import {
  LoanApplicationStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { addDays, format } from "date-fns";
import { AlertCircle, Info } from "lucide-react";
import { FiatLoanDetails } from "@frontend/http-client-lender";
import { AlertTitle, Card, CardContent } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { ScrollArea } from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import { Separator } from "@frontend/shadcn";
import { Input } from "@frontend/shadcn";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  newFormatCurrency,
  ONE_YEAR,
} from "@frontend/ui-shared";
import { AddFiatDetailsDialog } from "@frontend/ui-shared";

// Type for DataItem props
interface DataItemProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

// Type for take loan application params
interface TakeLoanParams {
  lender_npub: string;
  lender_pk: string;
  lender_derivation_path: string;
  loan_repayment_address: string;
  fiat_loan_details?: FiatLoanDetails;
  loan_amount: number;
  duration_days: number;
}

export default function TakeLoanApplication() {
  const navigate = useNavigate();
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { id } = useParams<{ id: string }>();

  const { getLoanApplication, takeLoanApplication } = useLenderHttpClient();
  const { encryptFiatLoanDetailsLender } = useWallet();
  const [isTaking, setIsTaking] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loanAddress, setLoanAddress] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [hideWalletConnectButton, setHideWalletConnectButton] =
    useState<boolean>(false);

  const {
    value: loanApplication,
    loading: loanApplicationLoading,
    error: loadingApplicationError,
  } = useAsync(async () => {
    if (id) {
      return getLoanApplication(id);
    }
    return undefined;
  }, [id]);

  // Initialize form values when loan application loads
  useEffect(() => {
    if (loanApplication) {
      // Set default values to the minimum of the range
      setLoanAmount(loanApplication.loan_amount_max);
      setDuration(loanApplication.duration_days_max);
    }
  }, [loanApplication]);

  const {
    value: lenderPubkey,
    loading: lenderPkLoading,
    error: lenderPkError,
  } = useAsync(async () => {
    return await getPkAndDerivationPath();
  });

  if (lenderPkError) {
    console.error(`Couldn't get pubkey ${lenderPkError}`);
  }

  const loading: boolean = lenderPkLoading || loanApplicationLoading;

  const interestRate: number | undefined = loanApplication?.interest_rate;

  // For calculations, use minimum values as they represent the guaranteed minimum
  const displayLoanAmount = loanApplication?.loan_amount_max;
  const displayDuration = loanApplication?.duration_days_max;

  const actualInterest: number | undefined =
    loanApplication &&
    displayDuration &&
    (loanApplication.interest_rate / ONE_YEAR) * displayDuration;

  const actualInterestUsdAmount: number | undefined =
    loanApplication &&
    actualInterest &&
    displayLoanAmount &&
    displayLoanAmount * actualInterest;

  const liquidationPrice: number | undefined =
    loanApplication?.liquidation_price;

  const expiry: Date | undefined =
    loanApplication && displayDuration
      ? addDays(new Date(), displayDuration)
      : undefined;

  const onSubmit = async (
    encryptedFiatLoanDetails?: FiatLoanDetails,
  ): Promise<void> => {
    try {
      if (!id) {
        setError("No loan application selected");
        return;
      }

      if (!lenderPubkey) {
        setError("No pubkey set");
        return;
      }

      setIsTaking(true);
      const lenderNpub: string = await getNpub();

      if (
        !encryptedFiatLoanDetails &&
        (!loanAddress || loanAddress.trim().length === 0)
      ) {
        setError("No payout details provided");
        return;
      }

      if (loanAmount <= 0) {
        setError("Please specify a valid loan amount");
        return;
      }

      if (duration <= 0) {
        setError("Please specify a valid duration");
        return;
      }

      // Validate that the specified values are within the borrower's ranges
      if (
        loanApplication &&
        (loanAmount < loanApplication.loan_amount_min ||
          loanAmount > loanApplication.loan_amount_max)
      ) {
        setError(
          `Loan amount must be between ${loanApplication.loan_amount_min} and ${loanApplication.loan_amount_max}`,
        );
        return;
      }

      if (
        loanApplication &&
        (duration < loanApplication.duration_days_min ||
          duration > loanApplication.duration_days_max)
      ) {
        setError(
          `Duration must be between ${loanApplication.duration_days_min} and ${loanApplication.duration_days_max} days`,
        );
        return;
      }

      const params: TakeLoanParams = {
        lender_npub: lenderNpub,
        lender_pk: lenderPubkey.pubkey,
        lender_derivation_path: lenderPubkey.path,
        loan_repayment_address: loanAddress,
        fiat_loan_details: encryptedFiatLoanDetails,
        loan_amount: loanAmount,
        duration_days: duration,
      };

      const contractId: string | undefined = await takeLoanApplication(
        id,
        params,
      );

      if (contractId !== undefined) {
        navigate(`/my-contracts/${contractId}`);
      } else {
        setError("Failed at taking loan application.");
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    } finally {
      setIsTaking(false);
    }
  };

  const buttonDisabled: boolean =
    loading || loanApplication?.status !== LoanApplicationStatus.Available;

  const isFiatLoanApplication: boolean =
    (loanApplication && LoanAssetHelper.isFiat(loanApplication?.loan_asset)) ||
    false;

  // Helper component for data list items
  const DataItem = ({ label, value, icon }: DataItemProps) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {icon && icon}
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );

  return (
    <ScrollArea className="h-[calc(100vh-4rem)] w-full">
      <div className="px-6 py-4 md:px-8">
        <h2 className="text-font dark:text-font-dark mb-6 text-2xl font-semibold">
          Loan Application Details
        </h2>
        <div className="grid grid-cols-1 gap-4 pb-8 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <h4 className="text-lg font-medium">
                  You will lend{" "}
                  {loading ? (
                    <Skeleton className="inline-block h-5 w-24" />
                  ) : (
                    <strong>
                      {loanApplication &&
                        formatCurrency(
                          loanAmount,
                          LoanAssetHelper.toCurrency(
                            loanApplication.loan_asset,
                          ),
                        )}
                    </strong>
                  )}{" "}
                  for{" "}
                  {loading ? (
                    <Skeleton className="inline-block h-5 w-24" />
                  ) : (
                    loanApplication && getFormatedStringFromDays(duration)
                  )}
                </h4>
              </div>

              <Separator className="my-4" />

              <DataItem
                label="Interest Rate"
                icon={<Info size={16} />}
                value={
                  loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <div className="flex flex-col items-end">
                      {displayDuration !== ONE_YEAR && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {actualInterest &&
                              (actualInterest * 100).toFixed(2)}
                            %
                          </span>
                          <span className="text-muted-foreground text-xs">
                            ({interestRate && (interestRate * 100).toFixed(1)}%
                            p.a.)
                          </span>
                        </div>
                      )}
                      {displayDuration === ONE_YEAR && (
                        <span className="text-sm font-semibold">
                          {actualInterest && (actualInterest * 100).toFixed(2)}%
                          p.a.
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs">
                        ≈{" "}
                        {actualInterestUsdAmount &&
                          formatCurrency(
                            actualInterestUsdAmount,
                            LoanAssetHelper.toCurrency(
                              loanApplication?.loan_asset,
                            ),
                            1,
                            1,
                          )}{" "}
                        in total
                      </span>
                    </div>
                  )
                }
              />

              <Separator className="my-2" />

              <DataItem
                label="Liquidation Price"
                icon={<Info size={16} />}
                value={
                  loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {liquidationPrice &&
                        newFormatCurrency({
                          value: liquidationPrice,
                          currency: LoanAssetHelper.toCurrency(
                            loanApplication?.loan_asset,
                          ),
                          maxFraction: 0,
                          minFraction: 0,
                        })}
                    </span>
                  )
                }
              />

              <Separator className="my-2" />

              <DataItem
                label="Expiry Date"
                value={
                  loading || !expiry ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {format(expiry, "MMM dd, yyyy")}
                    </span>
                  )
                }
              />

              <Separator className="my-2" />

              <DataItem
                label="Loan Asset"
                value={
                  loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {loanApplication &&
                        LoanAssetHelper.print(loanApplication.loan_asset)}
                    </span>
                  )
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              {/* Right side card content with loading states */}
              {loading ? (
                // Skeleton loading state for the right card
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                // Actual content when loaded
                <>
                  {/* Loan Amount and Duration Input Fields */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="loan-amount"
                        className="mb-2 block text-sm font-medium"
                      >
                        Loan Amount (
                        {LoanAssetHelper.toCurrency(
                          loanApplication?.loan_asset,
                        )}
                        )
                      </label>
                      <Input
                        id="loan-amount"
                        type="number"
                        placeholder={`Between ${loanApplication?.loan_amount_min || 0} and ${loanApplication?.loan_amount_max || 0}`}
                        value={loanAmount || ""}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                        min={loanApplication?.loan_amount_min}
                        max={loanApplication?.loan_amount_max}
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Must be between{" "}
                        {formatCurrency(
                          loanApplication?.loan_amount_min || 0,
                          LoanAssetHelper.toCurrency(
                            loanApplication?.loan_asset,
                          ),
                        )}{" "}
                        and{" "}
                        {formatCurrency(
                          loanApplication?.loan_amount_max || 0,
                          LoanAssetHelper.toCurrency(
                            loanApplication?.loan_asset,
                          ),
                        )}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="duration"
                        className="mb-2 block text-sm font-medium"
                      >
                        Duration (days)
                      </label>
                      <Input
                        id="duration"
                        type="number"
                        placeholder={`Between ${loanApplication?.duration_days_min || 0} and ${loanApplication?.duration_days_max || 0}`}
                        value={duration || ""}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        min={loanApplication?.duration_days_min}
                        max={loanApplication?.duration_days_max}
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Must be between{" "}
                        {loanApplication?.duration_days_min || 0} and{" "}
                        {loanApplication?.duration_days_max || 0} days
                      </p>
                    </div>
                  </div>

                  {!isFiatLoanApplication && (
                    <div className="space-y-2">
                      <LoanAddressInputField
                        loanAddress={loanAddress ?? ""}
                        setLoanAddress={setLoanAddress}
                        hideButton={hideWalletConnectButton}
                        setHideButton={setHideWalletConnectButton}
                        loanAsset={
                          loanApplication?.loan_asset || LoanAsset.USDC_POL
                        }
                        renderWarning={true}
                      />
                      <p className="text-muted-foreground text-sm">
                        The borrower will repay you to this address
                      </p>
                    </div>
                  )}

                  {loanApplication && isFiatLoanApplication && lenderPubkey && (
                    <div className={"flex w-full flex-col gap-2"}>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Heads up!</AlertTitle>
                        <AlertDescription>
                          <div>
                            <p>
                              You are lending USD{" "}
                              {formatCurrency(
                                loanAmount,
                                LoanAssetHelper.toCurrency(
                                  loanApplication.loan_asset,
                                ),
                              )}{" "}
                              worth of{" "}
                              {LoanAssetHelper.print(
                                loanApplication.loan_asset,
                              )}
                              .
                              {loanApplication.loan_asset !== LoanAsset.USD && (
                                <>
                                  {" "}
                                  This means{" "}
                                  <span className="font-bold">
                                    you need to send{" "}
                                    {LoanAssetHelper.print(
                                      loanApplication.loan_asset,
                                    )}
                                  </span>{" "}
                                  to the borrower.
                                </>
                              )}{" "}
                              Please provide your bank details so that the
                              borrower can repay at expiry.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                      <AddFiatDetailsDialog
                        onComplete={async (data) => {
                          const fiatLoanDetails =
                            await encryptFiatLoanDetailsLender(
                              data,
                              lenderPubkey.pubkey,
                              loanApplication.borrower_pk,
                            );
                          await onSubmit(fiatLoanDetails);
                        }}
                      >
                        <Button
                          size="default"
                          className="-px-4 w-full"
                          disabled={buttonDisabled}
                        >
                          {isTaking ? "Processing..." : "Take loan application"}
                        </Button>
                      </AddFiatDetailsDialog>
                    </div>
                  )}

                  {!isFiatLoanApplication && (
                    <Button
                      className="-px-4 w-full"
                      onClick={async (
                        e: React.MouseEvent<HTMLButtonElement>,
                      ) => {
                        e.preventDefault();
                        await onSubmit();
                      }}
                      disabled={buttonDisabled || isTaking}
                    >
                      {isTaking ? "Processing..." : "Take loan application"}
                    </Button>
                  )}
                </>
              )}

              {(error || loadingApplicationError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error || loadingApplicationError?.message || ""}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
