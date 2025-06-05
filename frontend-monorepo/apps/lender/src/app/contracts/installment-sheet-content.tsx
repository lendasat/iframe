import { Installment, InstallmentStatus } from "@frontend/http-client-borrower";
import { InstallmentStatusBadge } from "./installment-status-badge";
import { formatDistance } from "date-fns";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@frontend/shadcn";
import { formatCurrency } from "@frontend/ui-shared";

export function InstallmentSheetContent({
  installment,
  isFiatLoan,
}: {
  installment: Installment;
  isFiatLoan: boolean;
}) {
  const today = new Date();

  const principal = formatCurrency(installment.principal);
  const interest = formatCurrency(installment.interest);
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Installment Details</SheetTitle>
        <SheetDescription>
          {getSheetDescription(installment.status, installment.due_date)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-6">
        <dl className="divide-y divide-muted">
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
              value={
                <span className="font-mono">{installment.payment_id}</span>
              }
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
