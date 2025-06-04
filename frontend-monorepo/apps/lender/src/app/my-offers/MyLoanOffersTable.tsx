import {
  LoanOffer,
  LoanOfferStatus,
  repaymentPlanLabel,
} from "@frontend/http-client-lender";
import {
  CurrencyFormatter,
  KycBadge,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import {
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Alert, AlertDescription } from "@frontend/shadcn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Edit,
  InfoIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "./status-badge";

export interface ColumnMeta {
  columnClasses: string;
}

export interface MyLoanOffersTableProps {
  offers: LoanOffer[];
}

export const MyLoanOffersTable = ({ offers }: MyLoanOffersTableProps) => {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "amount", desc: true },
  ]);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<string>(
    LoanOfferStatus.Available,
  );

  const uniqueStatuses = [
    LoanOfferStatus.Unavailable,
    LoanOfferStatus.Available,
  ];

  const columns: ColumnDef<LoanOffer>[] = useMemo(
    () => [
      {
        accessorKey: "loan_amount_min",
        id: "amount",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium"
          >
            Amount
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">
            <CurrencyFormatter value={row.original.loan_amount_min} /> -{" "}
            <CurrencyFormatter value={row.original.loan_amount_max} />
          </div>
        ),
      },
      {
        accessorKey: "duration_days_min",
        id: "duration",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium hidden md:flex"
          >
            Duration (days)
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium hidden md:block">
            {row.original.duration_days_min} - {row.original.duration_days_max}
          </div>
        ),
        meta: { columnClasses: "hidden md:table-cell" } as ColumnMeta,
      },
      {
        accessorKey: "interest_rate",
        id: "interest",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium hidden md:flex"
          >
            Interest
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium hidden md:block">
            {(row.original.interest_rate * 100).toFixed(2)}%
          </div>
        ),
        meta: { columnClasses: "hidden md:table-cell" } as ColumnMeta,
      },
      {
        accessorKey: "loan_asset",
        id: "coin",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium hidden md:flex"
          >
            Coin
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium hidden md:block">
            {LoanAssetHelper.print(row.original.loan_asset)}
          </div>
        ),
        meta: { columnClasses: "hidden md:table-cell" } as ColumnMeta,
      },
      {
        accessorKey: "repayment_plan",
        id: "repayment",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium hidden md:flex"
          >
            Loan Type
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium hidden md:block">
            {repaymentPlanLabel(row.original.repayment_plan)}
          </div>
        ),
        meta: { columnClasses: "hidden md:table-cell" } as ColumnMeta,
      },
      {
        accessorKey: "kyc_link",
        id: "requirements",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium hidden md:flex"
          >
            Requirements
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="hidden md:block">
            {row.original.kyc_link && <KycBadge />}
          </div>
        ),
        meta: { columnClasses: "hidden md:table-cell" } as ColumnMeta,
      },
      {
        accessorKey: "status",
        id: "status",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium"
          >
            Status
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => <StatusBadge offer={row.original} />,
        filterFn: (row, id, value) => {
          if (value === "all") return true;

          const rowStatus = row.getValue(id) as string;

          if (value === LoanOfferStatus.Unavailable) {
            return rowStatus !== LoanOfferStatus.Available;
          }

          return rowStatus === value;
        },
      },
      {
        accessorKey: "created_at",
        id: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-medium hidden md:flex"
          >
            Created At
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-1 h-3 w-3" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium hidden md:block">
            {row.original.created_at.toLocaleDateString([], {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        ),
        meta: { columnClasses: "hidden md:table-cell" } as ColumnMeta,
      },
      {
        id: "actions",
        header: () => <div className="font-medium">Edit</div>,
        cell: ({ row }) => (
          <div>
            <Button
              size="sm"
              onClick={() => navigate(`/my-offers/${row.original.id}`)}
              className="w-full"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  const table = useReactTable({
    data: offers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  // Handle status filter
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
  };

  useEffect(() => {
    table
      .getColumn("status")
      ?.setFilterValue(statusFilter === "all" ? undefined : statusFilter);
  }, [statusFilter, table]);

  return (
    <ScrollArea className="h-[80vh]">
      <div>
        {/* Filter Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter by status:</span>
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={
                        (header.column.columnDef.meta as ColumnMeta)
                          ?.columnClasses
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          (cell.column.columnDef.meta as ColumnMeta)
                            ?.columnClasses
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24">
                    <Alert>
                      <InfoIcon className="h-4 w-4" />
                      <AlertDescription>No loan offers found.</AlertDescription>
                    </Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
