import {
  LoanApplication,
  LoanApplicationStatus,
  LoanApplicationStatusHelper,
  LoanType,
} from "@frontend/http-client-lender";
import {
  BorrowerStatsLabel,
  formatCurrency,
  getFormatedStringFromDays,
  LoanAsset,
  LoanAssetHelper,
} from "@frontend/ui-shared";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn";
import {
  ColumnFiltersState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from "react-icons/lu";

const MobileLoanApplicationCard = ({
  application,
  loading,
  selected,
  onClick,
  enableActionColumn,
  onActionColumnAction,
}: {
  application: LoanApplication;
  loading: boolean;
  selected: boolean;
  onClick: (id: string) => void;
  enableActionColumn?: boolean;
  onActionColumnAction?: (application: LoanApplication) => void;
}) => {
  return (
    <Card
      className={`cursor-pointer ${selected ? "bg-purple-50" : ""}`}
      onClick={() => onClick(application.id)}
    >
      <CardContent className="p-4">
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="min-w-[88px] text-sm font-medium text-gray-600">
              Borrower
            </dt>
            <dd className="text-right text-sm">
              {loading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                application.borrower.name
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="min-w-[88px] text-sm font-medium text-gray-600">
              Amount
            </dt>
            <dd className="text-right text-sm">
              {loading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                formatCurrency(
                  application.loan_amount,
                  LoanAssetHelper.toCurrency(application.loan_asset),
                )
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="min-w-[88px] text-sm font-medium text-gray-600">
              Duration
            </dt>
            <dd className="text-right text-sm">
              {loading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                getFormatedStringFromDays(application.duration_days)
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="min-w-[88px] text-sm font-medium text-gray-600">
              Interest Rate
            </dt>
            <dd className="text-right text-sm">
              {loading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                `${(application.interest_rate * 100).toFixed(1)}%`
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="min-w-[88px] text-sm font-medium text-gray-600">
              LTV
            </dt>
            <dd className="text-right text-sm">
              {loading ? (
                <Skeleton className="h-4 w-12" />
              ) : (
                `${(application.ltv * 100).toFixed(0)}%`
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="min-w-[88px] text-sm font-medium text-gray-600">
              Coin
            </dt>
            <dd className="text-right text-sm">
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <Badge className="bg-purple-100 text-purple-800">
                  {LoanAssetHelper.print(application.loan_asset)}
                </Badge>
              )}
            </dd>
          </div>
          {enableActionColumn && onActionColumnAction && (
            <div className="flex items-center justify-between pt-2">
              <dt className="min-w-[88px] text-sm font-medium text-gray-600">
                Pick
              </dt>
              <dd className="text-right text-sm">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionColumnAction(application);
                    }}
                  >
                    Select
                  </Button>
                )}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
};

const columnHelper = createColumnHelper<LoanApplication>();

interface LoanApplicationTableProps {
  loanApplications: LoanApplication[];
  loading: boolean;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  enableRowSelection: boolean;
  onOfferSelect?: (offerId: string) => void;
  selectedOfferId?: string;
  enableActionColumn?: boolean;
  onActionColumnAction?: (offer: LoanApplication) => void;
}

export function LoanApplicationTable({
  loanApplications,
  loading,
  columnFilters,
  onColumnFiltersChange,
  enableRowSelection,
  onOfferSelect,
  selectedOfferId,
  enableActionColumn,
  onActionColumnAction,
}: LoanApplicationTableProps) {
  const columns = [
    columnHelper.accessor((row) => row.borrower, {
      id: "borrower",
      header: () => {
        return "Borrower";
      },
      cell: ({ cell }) => {
        const value = cell.getValue();
        return (
          <BorrowerStatsLabel
            name={value.name}
            id={value.id}
            showStats={true}
            showAvatar={true}
            ratingTextAlign={"left"}
            successful_contracts={value.successful_contracts}
          />
        );
      },
      filterFn: (
        row: Row<LoanApplication>,
        columnId: string,
        filterValue: string,
      ) => {
        if (!filterValue) return true;

        const amount = row.getValue(columnId) as number;

        const searchValue = parseFloat(filterValue.replace(/[^0-9.]/g, ""));
        return (
          !Number.isNaN(searchValue) &&
          searchValue >= amount &&
          searchValue <= amount
        );
      },
    }),
    columnHelper.accessor((row) => row.loan_amount, {
      id: "amount",
      header: () => {
        return "Amount";
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as number;
        const loanApplication = cell.row.original;
        return (
          <>
            {formatCurrency(
              value,
              LoanAssetHelper.toCurrency(loanApplication.loan_asset),
            )}
          </>
        );
      },
      filterFn: (
        row: Row<LoanApplication>,
        columnId: string,
        filterValue: string,
      ) => {
        if (!filterValue) return true;

        const amount = row.getValue(columnId) as number;

        const searchValue = parseFloat(filterValue.replace(/[^0-9.]/g, ""));
        return (
          !Number.isNaN(searchValue) &&
          searchValue >= amount &&
          searchValue <= amount
        );
      },
    }),
    columnHelper.accessor((row) => row.duration_days, {
      id: "duration",
      header: () => {
        return "Duration";
      },
      cell: ({ cell }) => {
        const value = cell.getValue() as number;
        return <>{getFormatedStringFromDays(value)}</>;
      },
      enableColumnFilter: true,
      filterFn: (
        row: Row<LoanApplication>,
        columnId: string,
        filterValue: string,
      ) => {
        if (!filterValue) return true;

        const duration = row.getValue(columnId) as number;

        const searchValue = parseFloat(filterValue.replace(/[^0-9.]/g, ""));
        return (
          !Number.isNaN(searchValue) &&
          searchValue >= duration &&
          searchValue <= duration
        );
      },
    }),
    columnHelper.accessor("ltv", {
      header: () => {
        return "LTV";
      },
      cell: ({ row }) => {
        if (loading) {
          return <Skeleton className="h-4 w-12" />;
        }
        return <>{((row.getValue("ltv") as number) * 100).toFixed(0)}%</>;
      },
      enableSorting: true,
    }),
    columnHelper.accessor("interest_rate", {
      header: () => {
        return "Interest Rate";
      },
      cell: ({ row }) => {
        return (
          <>{((row.getValue("interest_rate") as number) * 100).toFixed(1)}%</>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.loan_asset, {
      id: "Coin",
      header: () => {
        return "Coin";
      },
      cell: ({ cell }) => {
        return (
          <Badge className="bg-purple-100 text-purple-800">
            {LoanAssetHelper.print(cell.getValue())}
          </Badge>
        );
      },
    }),
    columnHelper.accessor((row) => row.status, {
      id: "Status",
      header: () => {
        return "Status";
      },
      cell: ({ cell }) => {
        return (
          <Badge className="bg-green-100 text-green-800">
            {LoanApplicationStatusHelper.print(cell.getValue())}
          </Badge>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: () => {
        return "Pick";
      },
      cell: (props) => (
        <Button
          onClick={
            onActionColumnAction
              ? () => {
                  onActionColumnAction(props.row.original as LoanApplication);
                }
              : undefined
          }
        >
          Select
        </Button>
      ),
      enableSorting: false,
      enableHiding: false,
    }),
  ];

  const data = useMemo(() => {
    if (loading) {
      return [
        {
          id: "dummy",
          ltv: 0,
          interest_rate: 0,
          loan_amount: 0,
          duration_days: 0,
          liquidation_price: 0.0,
          loan_asset: LoanAsset.USDT_POL,
          borrower: {
            id: "id",
            name: "dummy",
            successful_contracts: 0,
            joined_at: new Date(),
            timezone: "dummy",
          },
          borrower_loan_address: "dummy",
          borrower_btc_address: "dummy",
          borrower_pk: "dummy",
          loan_type: LoanType.StableCoin,
          status: LoanApplicationStatus.Available,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
    }
    return loanApplications;
  }, [loanApplications, loading]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    actions: enableActionColumn || false,
  });

  const rowSelection = useMemo(() => {
    return selectedOfferId ? { [selectedOfferId]: true } : {};
  }, [selectedOfferId]);

  const table = useReactTable({
    data,
    columns,
    getRowId: (originalRow) => originalRow.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      if (!onOfferSelect || !enableRowSelection) {
        return;
      }

      // When row selection changes, call onOfferSelect with the selected row id
      if (onOfferSelect) {
        const newValue =
          typeof updater === "function" ? updater(rowSelection) : updater;
        const selectedId = Object.keys(newValue)[0];
        onOfferSelect(selectedId);
      }
    },
    enableFilters: true,
    enableMultiRowSelection: false,
    enableRowSelection: enableRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="hidden md:block">
        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className="text-font dark:text-font-dark"
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            {...{
                              className: header.column.getCanSort()
                                ? "cursor-pointer select-none"
                                : "",
                              onClick: header.column.getToggleSortingHandler(),
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}

                              {header.column.getCanSort()
                                ? ({
                                    asc: <LuArrowUp />,
                                    desc: <LuArrowDown />,
                                  }[header.column.getIsSorted() as string] ?? (
                                    <LuArrowUpDown />
                                  ))
                                : undefined}
                            </div>
                          </div>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.getIsSelected()
                        ? "bg-purple-50 dark:bg-purple-100"
                        : ""
                    }
                    onClick={row.getToggleSelectedHandler()}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          row.getIsSelected()
                            ? "text-gray-900"
                            : "text-font dark:text-font-dark"
                        }
                      >
                        {loading ? (
                          <Skeleton className="h-4 w-20" />
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Mobile view */}
      <div className="block md:hidden">
        <div className="space-y-4">
          {loading ? (
            // Loading state for mobile
            [...Array(3)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : table.getRowModel().rows?.length ? (
            table
              .getRowModel()
              .rows.map((row) => (
                <MobileLoanApplicationCard
                  key={row.id}
                  application={row.original}
                  loading={loading}
                  selected={row.getIsSelected()}
                  onClick={(id) =>
                    enableRowSelection && onOfferSelect
                      ? onOfferSelect(id)
                      : undefined
                  }
                  enableActionColumn={enableActionColumn}
                  onActionColumnAction={onActionColumnAction}
                />
              ))
          ) : (
            <div className="text-font dark:text-font-dark p-4 text-center">
              No results.
            </div>
          )}
        </div>
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
  );
}
