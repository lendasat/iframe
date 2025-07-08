import { useWallet } from "@frontend/browser-wallet";
import { useState } from "react";
import {
  FiatLoanDetailsResponse,
  InnerFiatLoanDetails,
} from "@frontend/base-http-client";
import { Card, CardContent, Input, Label } from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Skeleton } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import { LuLoader, LuCircleAlert, LuCopy, LuCheck } from "react-icons/lu";

interface DataListItemProps {
  label: string;
  value?: string;
  loading: boolean;
}

function DataListItem({ label, value, loading }: DataListItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="flex flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      {/* Left-aligned label */}
      <div className="w-1/3 min-w-[240px] text-sm font-medium text-gray-500 dark:text-gray-400 text-left">
        {label}
      </div>

      {/* Container for the value content */}
      <div className="w-2/3 text-sm justify-end">
        {loading ? (
          <div className="flex justify-end">
            <Skeleton className="h-5 w-[150px]" />
          </div>
        ) : (
          <div className="flex items-center justify-end space-x-2">
            <p className="font-mono text-sm font-semibold">{value}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => handleCopy(value || "")}
            >
              {copied ? (
                <LuCheck className="h-4 w-4 text-green-600" />
              ) : (
                <LuCopy className="h-4 w-4" />
              )}
              <span className="sr-only">Copy value</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface BankingDetailsSummaryProps {
  fiatLoanDetails?: FiatLoanDetailsResponse;
  ownDerivationPath?: string;
}

export const BankingDetailsSummary = ({
  fiatLoanDetails,
  ownDerivationPath,
}: BankingDetailsSummaryProps) => {
  const { decryptFiatLoanDetailsWithPassword } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [loanDetails, setLoanDetails] = useState<
    InnerFiatLoanDetails | undefined
  >();

  const [error, setError] = useState("");

  const decryptPaymentDetails = async () => {
    if (fiatLoanDetails && ownDerivationPath) {
      setIsLoading(true);

      try {
        const loanDetails = await decryptFiatLoanDetailsWithPassword(
          password,
          fiatLoanDetails.details,
          fiatLoanDetails.encrypted_encryption_key,
          ownDerivationPath,
        );
        setLoanDetails(loanDetails);
        setIsDecrypted(true);
      } catch (e) {
        console.error(`Failed to decrypt fiat payment details ${e}`);
        setError(`${e}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isIban = loanDetails?.iban_transfer_details !== undefined;

  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h3 className="text-xl font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">
          Banking Details
        </h3>

        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6">
            {isIban && (
              <>
                <DataListItem
                  loading={isLoading || !isDecrypted}
                  label="IBAN"
                  value={loanDetails?.iban_transfer_details?.iban}
                />
                <DataListItem
                  loading={isLoading || !isDecrypted}
                  label="BIC"
                  value={loanDetails?.iban_transfer_details?.bic}
                />
              </>
            )}
            {!isIban && (
              <>
                <DataListItem
                  loading={isLoading || !isDecrypted}
                  label="Account number"
                  value={loanDetails?.swift_transfer_details?.account_number}
                />
                <DataListItem
                  loading={isLoading || !isDecrypted}
                  label="SWIFT or BIC"
                  value={loanDetails?.swift_transfer_details?.swift_or_bic}
                />
              </>
            )}
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Bank Name"
              value={loanDetails?.bank_name}
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Bank Address"
              value={loanDetails?.bank_address}
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Bank Country"
              value={loanDetails?.bank_country}
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Payment purpose"
              value={loanDetails?.purpose_of_remittance}
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xl font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">
          Beneficiary Details
        </h3>

        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6">
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Full Name"
              value={loanDetails?.full_name}
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Address"
              value={
                loanDetails
                  ? `${loanDetails?.address || ""}, ${
                      loanDetails?.city || ""
                    }, ${loanDetails?.post_code || ""}, ${
                      loanDetails?.country || ""
                    }`
                      .replace(/^, /, "")
                      .replace(/, $/, "")
                  : ""
              }
            />
            <DataListItem
              loading={isLoading || !isDecrypted}
              label="Additional comments"
              value={loanDetails?.comments}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid w-full">
        <Label htmlFor="password">Password</Label>
        <Input
          type="password"
          id="password"
          value={password}
          className={"w-full"}
          onChange={(val) => setPassword(val.target.value)}
        />
      </div>

      <div className="flex justify-end mt-6">
        <div className="min-w-[240px]"></div>
        <div>
          <Button
            type="button"
            disabled={isLoading || isDecrypted}
            onClick={decryptPaymentDetails}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <LuLoader className="h-4 w-4 animate-spin" />
                <span>Please wait</span>
              </>
            ) : (
              "Decrypt payment details"
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <LuCircleAlert className="h-4 w-4 mr-2" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
