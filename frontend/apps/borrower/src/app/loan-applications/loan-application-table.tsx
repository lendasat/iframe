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
} from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import { Skeleton } from "@radix-ui/themes";
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
                  <Skeleton loading={loading}>
                    {formatCurrency(
                      application.loan_amount,
                      LoanAssetHelper.toCurrency(application.loan_asset),
                    )}
                  </Skeleton>
                </TableCell>
                <TableCell>
                  <Skeleton loading={loading}>
                    {getFormatedStringFromDays(application.duration_days)}
                  </Skeleton>
                </TableCell>
                <TableCell>
                  <Skeleton loading={loading}>
                    {(application.interest_rate * 100).toFixed(1)}%
                  </Skeleton>
                </TableCell>
                <TableCell>
                  <Skeleton loading={loading}>
                    {(application.ltv * 100).toFixed(0)}%
                  </Skeleton>
                </TableCell>
                <TableCell>
                  <Badge color="purple">
                    <Skeleton loading={loading}>
                      {LoanAssetHelper.print(application.loan_asset)}
                    </Skeleton>
                  </Badge>
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
            loan_amount: number,
            duration_days: number,
            interest_rate: number,
            ltv: number,
          ) => {
            try {
              await editLoanApplication(
                selectedLoanApplication.loan_deal_id,
                loan_amount,
                duration_days,
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
