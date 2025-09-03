import { Control } from "react-hook-form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FiatLoanDetails, LoanOffer } from "@frontend/http-client-borrower";
import {
  AddFiatDetailsDialog,
  LoanAddressInputField,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { KycDialog } from "../kyc-dialog";
import { LoanProductTypes } from "../loan-request-flow";
import { toast } from "sonner";
import { LoanFormData } from "../loan-offer-details";
import { useState } from "react";

interface MoonCard {
  id: string;
  pan: string;
}

interface PaymentSetupStepProps {
  control: Control<LoanFormData>;
  offer: LoanOffer;
  paymentType: LoanProductTypes;

  // Address fields
  needsStablecoinAddress: boolean;

  // Banking
  needsBanking: boolean;
  fiatTransferDetailsConfirmed: boolean;
  setFiatTransferDetailsConfirmed: (confirmed: boolean) => void;
  setEncryptedFiatTransferDetails: (details: FiatLoanDetails) => void;

  // KYC
  needsKyc: boolean;
  isKycChecked: boolean;
  setIsKycChecked: (checked: boolean) => void;
  kycFormDialogConfirmed: boolean;
  setKycFormDialogConfirmed: (confirmed: boolean) => void;

  // Moon cards
  moonCards: MoonCard[];
  moonCardsLoading: boolean;

  // Bringin
  bringinButNoKey: boolean;

  // Wallet functions
  getPkAndDerivationPath: () => Promise<{ pubkey: string; path: string }>;
  encryptFiatLoanDetailsBorrower: (
    // biome-ignore lint/suspicious/noExplicitAny: External API function signature requires any
    data: any,
    pubkey: string,
    lenderPk: string,
  ) => Promise<FiatLoanDetails>;
  setOwnPk: (pk: string) => void;
  setOwnPath: (path: string) => void;
}

const NEW_CARD_CONSTANT = "New";

export const PaymentSetupStep = ({
  control,
  offer,
  paymentType,
  needsStablecoinAddress,
  needsBanking,
  fiatTransferDetailsConfirmed,
  setFiatTransferDetailsConfirmed,
  setEncryptedFiatTransferDetails,
  needsKyc,
  isKycChecked,
  setIsKycChecked,
  kycFormDialogConfirmed,
  setKycFormDialogConfirmed,
  moonCards,
  moonCardsLoading,
  bringinButNoKey,
  getPkAndDerivationPath,
  encryptFiatLoanDetailsBorrower,
  setOwnPk,
  setOwnPath,
}: PaymentSetupStepProps) => {
  const navigate = useNavigate();
  const { offerId, step } = useParams<{ offerId: string; step?: string }>();
  const [searchParams] = useSearchParams();

  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  const updateUrlParams = (
    bitcoinAddress?: string,
    stablecoinAddress?: string,
    moonCardId?: string,
  ) => {
    const newParams = new URLSearchParams(searchParams);

    if (bitcoinAddress !== undefined) {
      if (bitcoinAddress.trim().length > 0) {
        newParams.set("bitcoinAddress", bitcoinAddress);
      } else {
        newParams.delete("bitcoinAddress");
      }
    }

    if (stablecoinAddress !== undefined) {
      if (stablecoinAddress.trim().length > 0) {
        newParams.set("stablecoinAddress", stablecoinAddress);
      } else {
        newParams.delete("stablecoinAddress");
      }
    }

    if (moonCardId !== undefined) {
      if (moonCardId.trim().length > 0) {
        newParams.set("moonCardId", moonCardId);
      } else {
        newParams.delete("moonCardId");
      }
    }

    const currentStep = step || "payment";
    navigate(`/loan-offers/${offerId}/${currentStep}?${newParams.toString()}`, {
      replace: true,
    });
  };
  return (
    <div className="w-full space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payment Setup
          </CardTitle>
          <CardDescription>
            Configure addresses and payment details for your loan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bitcoin Refund Address - Always required */}
          <FormField
            control={control}
            name="bitcoinAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">
                  Bitcoin Collateral Address
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="bc1q..."
                    className="font-mono"
                    data-1p-ignore
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      updateUrlParams(e.target.value, undefined, undefined);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Your BTC collateral will be returned to this address after
                  repayment
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Stablecoin Address - Conditional */}
          {needsStablecoinAddress && (
            <FormField
              control={control}
              name="stablecoinAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">
                    {LoanAssetHelper.print(offer.loan_asset)} Receiving Address
                  </FormLabel>
                  <FormControl>
                    <LoanAddressInputField
                      loanAddress={field.value || ""}
                      setLoanAddress={(address) => {
                        field.onChange(address);
                        updateUrlParams(undefined, address, undefined);
                      }}
                      hideButton={hideWalletConnectButton}
                      setHideButton={setHideWalletConnectButton}
                      loanAsset={offer.loan_asset}
                      renderWarning={true}
                    />
                  </FormControl>
                  <FormDescription>
                    The loan will be paid out to this address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Banking Details - Conditional */}
          {needsBanking && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Banking Details</Label>
              <AddFiatDetailsDialog
                onComplete={async (data) => {
                  const pkAndPath = await getPkAndDerivationPath();
                  setOwnPk(pkAndPath.pubkey);
                  setOwnPath(pkAndPath.path);

                  const fiatLoanDetails = await encryptFiatLoanDetailsBorrower(
                    data,
                    pkAndPath.pubkey,
                    offer.lender_pk,
                  );
                  setEncryptedFiatTransferDetails(fiatLoanDetails);
                  setFiatTransferDetailsConfirmed(true);
                  toast.success("Banking details saved");
                }}
              >
                <Button
                  type="button"
                  variant={
                    fiatTransferDetailsConfirmed ? "secondary" : "outline"
                  }
                  className="w-full"
                  disabled={fiatTransferDetailsConfirmed}
                >
                  {fiatTransferDetailsConfirmed ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Banking details provided
                    </>
                  ) : (
                    "Provide banking details"
                  )}
                </Button>
              </AddFiatDetailsDialog>
            </div>
          )}

          {/* Moon Card Selection */}
          {paymentType === LoanProductTypes.PayWithMoon && (
            <FormField
              control={control}
              name="moonCardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-base font-medium">
                    <CreditCard className="h-4 w-4" />
                    Credit Card
                  </FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      updateUrlParams(undefined, undefined, value);
                    }}
                    defaultValue={field.value}
                    disabled={moonCardsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an existing or new card" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem id="New" value={NEW_CARD_CONSTANT}>
                        Create New Card
                      </SelectItem>
                      {moonCards.map((card) => (
                        <SelectItem key={card.id} id={card.id} value={card.id}>
                          **** **** **** {card.pan.slice(-4)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The loan will be paid to your credit card. You can create a
                    new card or top up an existing one.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Alerts and Additional Requirements */}
      <div className="space-y-4">
        {(needsKyc || bringinButNoKey) && (
          <div className="mb-4 text-center">
            <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
              Additional Requirements
            </h3>
          </div>
        )}
        {/* KYC Alert */}
        {needsKyc && (
          <Alert variant={kycFormDialogConfirmed ? "default" : "destructive"}>
            {kycFormDialogConfirmed ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-3">
                <p>Identity verification is required for this loan.</p>
                <KycDialog
                  selectedOffer={offer}
                  checked={isKycChecked}
                  onCheckedChange={setIsKycChecked}
                  onConfirm={() => setKycFormDialogConfirmed(true)}
                />
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Bringin API Key Warning */}
        {bringinButNoKey && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Key Required</AlertTitle>
            <AlertDescription>
              You haven't connected your Bringin account yet.{" "}
              <Link
                to="/settings/integrations"
                className="inline-flex items-center font-medium underline"
              >
                Connect in Settings
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
