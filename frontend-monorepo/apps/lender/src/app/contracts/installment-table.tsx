import * as React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Sheet,
  SheetContent,
} from "@frontend/shadcn";
import { Installment } from "@frontend/http-client-borrower";
import { InstallmentStatusBadge } from "./installment-status-badge";
import { InstallmentSheetContent } from "./installment-sheet-content";
import { formatCurrency } from "@frontend/ui-shared";
import { compareAsc, format } from "date-fns";

interface Props {
  installments: Installment[];
  isFiatLoan: boolean;
}

export function InstallmentTable({
  installments: unosrtedInstallments,
  isFiatLoan,
}: Props) {
  const [selected, setSelected] = React.useState<Installment | null>(null);

  const installments = unosrtedInstallments.sort((a, b) =>
    compareAsc(a.due_date, b.due_date),
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Principal</TableHead>
            <TableHead>Interest</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((inst) => (
            <TableRow
              key={inst.id}
              onClick={() => setSelected(inst)}
              className="cursor-pointer"
            >
              <TableCell>{formatCurrency(inst.principal)}</TableCell>
              <TableCell>{formatCurrency(inst.interest)}</TableCell>
              <TableCell>{format(inst.due_date, "MMM, dd yyyy")}</TableCell>
              <TableCell>
                <InstallmentStatusBadge
                  status={inst.status}
                  dueDate={inst.due_date}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent>
          {selected && (
            <InstallmentSheetContent
              installment={selected}
              isFiatLoan={isFiatLoan}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
