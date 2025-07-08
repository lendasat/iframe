import { InstallmentStatus } from "@frontend/http-client-borrower";
import { Badge } from "@frontend/shadcn";

function getBadgeVariant(
  status: InstallmentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case InstallmentStatus.Paid:
      return "default";
    case InstallmentStatus.Confirmed:
      return "default";
    case InstallmentStatus.Late:
      return "destructive";
    case InstallmentStatus.Cancelled:
      return "outline";
    case InstallmentStatus.Pending:
      return "secondary";
  }
}

function getStatusMessage(status: InstallmentStatus, dueDate: Date): string {
  switch (status) {
    case InstallmentStatus.Paid:
      return "Paid";
    case InstallmentStatus.Confirmed:
      return "Payment confirmed";
    case InstallmentStatus.Late:
      return "Overdue";
    case InstallmentStatus.Cancelled:
      return "Cancelled";
    case InstallmentStatus.Pending:
      if (dueDate) {
        const now = new Date();
        const threeDaysFromNow = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 3,
        );
        if (dueDate <= threeDaysFromNow && dueDate >= now) {
          return "Due soon";
        }
      }
      return "Pending";
  }
}

export function InstallmentStatusBadge({
  status,
  dueDate,
}: {
  status: InstallmentStatus;
  dueDate: Date;
}) {
  return (
    <Badge variant={getBadgeVariant(status)}>
      {getStatusMessage(status, dueDate)}
    </Badge>
  );
}
