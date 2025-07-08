import { Contract, InstallmentStatus } from "@frontend/http-client-borrower";
import { Label, Skeleton } from "@frontend/shadcn";
import { formatCurrency, LoanAssetHelper } from "@frontend/ui-shared";
import { StablecoinRepayment } from "./stablecoin-repayment";
import { FiatRepayment } from "./fiat-repayment";

interface RepaymentProps {
  contract?: Contract;
  refreshContract: () => void;
  onSubmit: () => void;
}

export function Repayment({
  contract,
  refreshContract,
  onSubmit,
}: RepaymentProps) {
  const nextInstallment = contract?.installments
    ?.filter(
      (installment) =>
        installment.status === InstallmentStatus.Pending ||
        installment.status === InstallmentStatus.Late,
    )
    ?.sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    )[0];

  const principalAmount = Number(nextInstallment?.principal) || 0;
  const interestAmount = Number(nextInstallment?.interest) || 0;
  const totalRepaymentAmount =
    nextInstallment?.principal !== undefined &&
    nextInstallment?.interest !== undefined
      ? principalAmount + interestAmount
      : undefined;

  const assetCoin = contract?.loan_asset
    ? LoanAssetHelper.toCoin(contract.loan_asset)
    : undefined;

  return (
    <>
      <div className="space-y-2">
        <h3 className="font-medium">Payment Details</h3>
        <div className="grid grid-cols-2 gap-2">
          {principalAmount > 0 && (
            <div>
              <Label>Principal Amount</Label>
              {principalAmount !== undefined ? (
                <p className="text-lg font-bold">
                  {formatCurrency(
                    principalAmount,
                    LoanAssetHelper.toCurrency(contract?.loan_asset),
                  )}
                </p>
              ) : (
                <Skeleton className="h-4 w-[150px]" />
              )}
            </div>
          )}
          <div>
            <Label>Interest</Label>
            {interestAmount !== undefined ? (
              <p className="text-lg font-bold">
                {formatCurrency(
                  interestAmount,
                  LoanAssetHelper.toCurrency(contract?.loan_asset),
                )}
              </p>
            ) : (
              <Skeleton className="h-4 w-[150px]" />
            )}
          </div>
        </div>
        <div className="mt-2 border-t pt-2">
          <Label>Total Payment</Label>
          {totalRepaymentAmount !== undefined ? (
            <p className="text-xl font-bold">
              {formatCurrency(
                totalRepaymentAmount,
                LoanAssetHelper.toCurrency(contract?.loan_asset),
              )}{" "}
              {assetCoin}
            </p>
          ) : (
            <Skeleton className="h-4 w-[150px]" />
          )}
        </div>
      </div>

      {contract?.loan_asset &&
        LoanAssetHelper.isStableCoin(contract.loan_asset) && (
          <StablecoinRepayment
            contract={contract}
            installment={nextInstallment}
            refreshContract={refreshContract}
            onSubmit={onSubmit}
          />
        )}

      {contract?.loan_asset && LoanAssetHelper.isFiat(contract.loan_asset) && (
        <FiatRepayment
          contract={contract}
          installment={nextInstallment}
          refreshContract={refreshContract}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}
