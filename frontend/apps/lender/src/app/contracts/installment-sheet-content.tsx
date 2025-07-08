import { Installment, InstallmentStatus } from "@frontend/http-client-borrower";
import { InstallmentStatusBadge } from "./installment-status-badge";
import { formatDistance } from "date-fns";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@frontend/shadcn";
import {
  formatCurrency,
  LoanAsset,
  getTxUrl,
  LoanAssetHelper,
} from "@frontend/ui-shared";

export function InstallmentSheetContent({
  installment,
  isFiatLoan,
  loanAsset,
}: {
  installment: Installment;
  isFiatLoan: boolean;
  loanAsset?: LoanAsset;
}) {
  const today = new Date();

  const principal = formatCurrency(
    installment.principal,
    LoanAssetHelper.toCurrency(loanAsset),
  );
  const interest = formatCurrency(
    installment.interest,
    LoanAssetHelper.toCurrency(loanAsset),
  );
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Installment Details</SheetTitle>
        <SheetDescription>
          {getSheetDescription(installment.status, installment.due_date)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-6">
        <dl className="divide-muted divide-y">
          <DetailRow
            label="ID"
            value={<span className="font-mono text-xs">{installment.id}</span>}
          />
          <DetailRow label="Principal" value={<span>{principal}</span>} />
          <DetailRow label="Interest" value={<span>{interest}</span>} />
          <DetailRow
            label="Due Date"
            value={formatDistance(new Date(installment.due_date), today, {
              addSuffix: true,
            })}
          />
          {installment.paid_date && (
            <DetailRow
              label="Paid Date"
              value={new Date(installment.paid_date).toLocaleDateString(
                "en-US",
              )}
            />
          )}
          {installment.payment_id && (
            <DetailRow
              label={isFiatLoan ? "Payment Reference" : "TXID"}
              value={(() => {
                const txUrl = loanAsset
                  ? getTxUrl(installment.payment_id, loanAsset)
                  : undefined;
                const commonClasses =
                  "font-mono text-xs max-w-32 truncate block select-all";

                if (txUrl) {
                  return (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${commonClasses} cursor-pointer text-blue-600 underline hover:text-blue-800`}
                      title={installment.payment_id}
                    >
                      {installment.payment_id}
                    </a>
                  );
                }

                return (
                  <span
                    className={`${commonClasses} cursor-pointer`}
                    title={installment.payment_id}
                  >
                    {installment.payment_id}
                  </span>
                );
              })()}
            />
          )}
          <DetailRow
            label="Status"
            value={
              <InstallmentStatusBadge
                status={installment.status}
                dueDate={installment.due_date}
              />
            }
          />
        </dl>
      </div>
    </SheetContent>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-right text-base">{value}</dd>
    </div>
  );
}

function getSheetDescription(
  status: InstallmentStatus,
  dueDate: Date,
): React.ReactNode {
  const dueDateStr = new Date(dueDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  switch (status) {
    case InstallmentStatus.Pending:
      return <span>This installment should be paid before {dueDateStr}.</span>;
    case InstallmentStatus.Paid:
      return <span>This installment was paid, pending your confirmation.</span>;
    case InstallmentStatus.Confirmed:
      return <span>This installment was paid in time.</span>;
    case InstallmentStatus.Late:
      return <span>This installment is overdue.</span>;
    case InstallmentStatus.Cancelled:
      return (
        <span>
          This installment was cancelled. It does not require payment.
        </span>
      );
  }
}
