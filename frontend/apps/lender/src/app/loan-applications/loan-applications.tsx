import { useState, ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAsync } from "react-use";
import { useWallet } from "@frontend/browser-wallet";
import {
  LoanApplicationStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { addDays } from "date-fns";
import { AlertCircle, Info } from "lucide-react";
import { FiatLoanDetails } from "@frontend/http-client-lender";
import { AlertTitle, Card, CardContent } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { ScrollArea } from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import { Separator } from "@frontend/shadcn";
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

  const actualInterest: number | undefined =
    loanApplication &&
    (loanApplication.interest_rate / ONE_YEAR) * loanApplication.duration_days;

  const actualInterestUsdAmount: number | undefined =
    loanApplication &&
    actualInterest &&
    loanApplication.loan_amount * actualInterest;

  const liquidationPrice: number | undefined =
    loanApplication?.liquidation_price;

  const expiry: Date | undefined =
    loanApplication && addDays(new Date(), loanApplication.duration_days);

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

      const params: TakeLoanParams = {
        lender_npub: lenderNpub,
        lender_pk: lenderPubkey.pubkey,
        lender_derivation_path: lenderPubkey.path,
        loan_repayment_address: loanAddress,
        fiat_loan_details: encryptedFiatLoanDetails,
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
        <h2 className="text-2xl font-semibold text-font dark:text-font-dark mb-6">
          Loan Application Details
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pb-8">
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
                          loanApplication.loan_amount,
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
                    loanApplication &&
                    getFormatedStringFromDays(loanApplication.duration_days)
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
                      {loanApplication?.duration_days !== ONE_YEAR && (
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
                      {loanApplication?.duration_days === ONE_YEAR && (
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
                  loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {expiry?.toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
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
                        This address will be used to transfer the loan amount
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
                                loanApplication.loan_amount,
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
