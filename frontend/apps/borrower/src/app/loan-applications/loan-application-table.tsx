import {
  LoanApplication,
  LoanApplicationStatus,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Alert,
  AlertTitle,
  AlertDescription,
  Button,
  Badge,
  Skeleton,
} from "@frontend/shadcn";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { useState } from "react";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import EditLoanApplicationDialog from "./edit-loan-application-dialog";
import { toast } from "sonner";

interface LoanApplicationTableProps {
  loanApplications: LoanApplication[];
  loading: boolean;
  triggerRefresh: () => void;
}

export function LoanApplicationTable({
  loanApplications,
  loading,
  triggerRefresh,
}: LoanApplicationTableProps) {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedLoanApplication = loanApplications.find(
    (a) => a.loan_deal_id === selectedRow,
  );

  const { deleteLoanApplication, editLoanApplication } =
    useHttpClientBorrower();

  const openLoanApplications = loanApplications.filter(
    (a) => a.status === LoanApplicationStatus.Available,
  );

  const onDelete = async (loanDealId: string) => {
    try {
      await deleteLoanApplication(loanDealId);

      triggerRefresh();

      toast.success("Loan request deleted.");
    } catch (e) {
      const error = e instanceof Error ? e.message : e;

      const errorString =
        error === ""
          ? "Failed to delete loan request."
          : `Failed to delete loan request: ${error}.`;

      toast.error(errorString);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Amount</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Interest Rate</TableHead>
            <TableHead>LTV</TableHead>
            <TableHead>Coin</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {openLoanApplications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <Alert variant="default">
                  <AlertTitle>Info</AlertTitle>
                  <AlertDescription>No results.</AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : (
            openLoanApplications.map((application) => (
              <TableRow key={application.loan_deal_id}>
                <TableCell>
                  {loading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : application.loan_amount_min ===
                    application.loan_amount_max ? (
                    formatCurrency(
                      application.loan_amount_min,
                      LoanAssetHelper.toCurrency(application.loan_asset),
                    )
                  ) : (
                    `${formatCurrency(
                      application.loan_amount_min,
                      LoanAssetHelper.toCurrency(application.loan_asset),
                    )} - ${formatCurrency(
                      application.loan_amount_max,
                      LoanAssetHelper.toCurrency(application.loan_asset),
                    )}`
                  )}
                </TableCell>
                <TableCell>
                  {loading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : application.duration_days_min ===
                    application.duration_days_max ? (
                    getFormatedStringFromDays(application.duration_days_min)
                  ) : (
                    `${getFormatedStringFromDays(application.duration_days_min)} - ${getFormatedStringFromDays(application.duration_days_max)}`
                  )}
                </TableCell>
                <TableCell>
                  {loading ? (
                    <Skeleton className="h-4 w-12" />
                  ) : (
                    `${(application.interest_rate * 100).toFixed(1)}%`
                  )}
                </TableCell>
                <TableCell>
                  {loading ? (
                    <Skeleton className="h-4 w-12" />
                  ) : (
                    `${(application.ltv * 100).toFixed(0)}%`
                  )}
                </TableCell>
                <TableCell>
                  {loading ? (
                    <Skeleton className="h-5 w-16" />
                  ) : (
                    <Badge variant="secondary">
                      {LoanAssetHelper.print(application.loan_asset)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setSelectedRow(application.loan_deal_id);
                      setIsDialogOpen(true);
                    }}
                  >
                    <LuPencil className="h-1 w-1" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      onDelete(application.loan_deal_id);
                    }}
                  >
                    <LuTrash2 className="h-1 w-1" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {selectedLoanApplication && (
        <EditLoanApplicationDialog
          isDialogOpen={isDialogOpen}
          handleDialogClose={() => setIsDialogOpen(false)}
          currentLoanApplication={selectedLoanApplication}
          onSubmit={async (
            loan_amount_min: number,
            loan_amount_max: number,
            duration_days_min: number,
            duration_days_max: number,
            interest_rate: number,
            ltv: number,
          ) => {
            try {
              await editLoanApplication(
                selectedLoanApplication.loan_deal_id,
                loan_amount_min,
                loan_amount_max,
                duration_days_min,
                duration_days_max,
                interest_rate,
                ltv,
              );

              triggerRefresh();
            } catch (e) {
              const error = e instanceof Error ? e.message : e;
              toast.error(`Failed to edit loan request: ${error}.`);
            }
          }}
        />
      )}
    </>
  );
}
