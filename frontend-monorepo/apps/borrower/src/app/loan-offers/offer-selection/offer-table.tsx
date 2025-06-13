import { LoanOffer, RepaymentPlan } from "@frontend/http-client-borrower";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAsset,
  LoanAssetHelper,
  LoanPayout,
} from "@frontend/ui-shared";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
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
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { Lender } from "../lender";

interface DurationRange {
  min: number;
  max: number;
}

interface AmountRange {
  min: number;
  max: number;
}

const MobileOfferCard = ({
  offer,
  loading,
  selected,
  onClick,
  enableActionColumn,
  onActionColumnAction,
}: {
  offer: LoanOffer;
  loading: boolean;
  selected: boolean;
  onClick: (id: string) => void;
  enableActionColumn?: boolean;
  onActionColumnAction?: (offer: LoanOffer) => void;
}) => {
  let repaymentPlan = <></>;
  switch (offer.repayment_plan) {
    case RepaymentPlan.InterestOnlyMonthly:
      repaymentPlan = <Badge variant="secondary">{"Monthly interest"}</Badge>;
      break;
    case RepaymentPlan.InterestOnlyWeekly:
      repaymentPlan = <Badge variant="secondary">{"Weekly interest"}</Badge>;
      break;
    case RepaymentPlan.Bullet:
      repaymentPlan = <Badge variant="secondary">{"Bullet loan"}</Badge>;
      break;
  }

  return (
    <div
      className={`cursor-pointer rounded-lg border p-4 ${
        selected ? "bg-muted" : "bg-background"
      }`}
      onClick={() => onClick(offer.id)}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            Lender
          </span>
          <div className="text-right">
            {loading ? (
              <div className="bg-muted h-4 w-20 animate-pulse rounded"></div>
            ) : (
              <Lender
                {...offer.lender}
                showAvatar={false}
                ratingTextAlign={"right"}
              />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            Amounts
          </span>
          <span className="text-sm">
            {loading ? (
              <div className="bg-muted h-4 w-24 animate-pulse rounded"></div>
            ) : (
              `${formatCurrency(offer.loan_amount_min)} - ${formatCurrency(offer.loan_amount_max)}`
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            Duration
          </span>
          <span className="text-sm">
            {loading ? (
              <div className="bg-muted h-4 w-16 animate-pulse rounded"></div>
            ) : (
              `${getFormatedStringFromDays(offer.duration_days_min)} - ${getFormatedStringFromDays(offer.duration_days_max)}`
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            Interest
          </span>
          <span className="text-sm">
            {loading ? (
              <div className="bg-muted h-4 w-12 animate-pulse rounded"></div>
            ) : (
              `${(offer.interest_rate * 100).toFixed(1)}%`
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            <div>
              {"Repayment Plan"}
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Bullet loans have a lump-sum payment at the end.
                    <br />
                    Monthly interest loans require regular payments.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </span>
          <span className="text-sm">
            {loading ? (
              <div className="bg-muted h-4 w-12 animate-pulse rounded"></div>
            ) : (
              repaymentPlan
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">LTV</span>
          <span className="text-sm">
            {loading ? (
              <div className="bg-muted h-4 w-12 animate-pulse rounded"></div>
            ) : (
              `${(offer.min_ltv * 100).toFixed(0)}%`
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            Coin
          </span>
          <Badge>
            {loading ? (
              <div className="bg-muted h-4 w-16 animate-pulse rounded"></div>
            ) : (
              LoanAssetHelper.print(offer.loan_asset)
            )}
          </Badge>
        </div>
        {enableActionColumn && onActionColumnAction && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">
              Pick
            </span>
            <Button
              size="sm"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                onActionColumnAction(offer);
              }}
            >
              Select
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const columnHelper = createColumnHelper<LoanOffer>();

interface LoanOfferTableProps {
  loanOffers: LoanOffer[];
  loading: boolean;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  enableRowSelection: boolean;
  onOfferSelect?: (offerId: string) => void;
  selectedOfferId?: string;
  enableActionColumn?: boolean;
  onActionColumnAction?: (offer: LoanOffer) => void;
}

export function LoanOfferTable({
  loanOffers,
  loading,
  columnFilters,
  onColumnFiltersChange,
  enableRowSelection,
  onOfferSelect,
  selectedOfferId,
  enableActionColumn,
  onActionColumnAction,
}: LoanOfferTableProps) {
  const columns = [
    columnHelper.accessor("lender", {
      header: () => {
        return "Lender";
      },
      cell: ({ row }) => {
        return <Lender {...row.getValue("lender")} showAvatar={true} />;
      },
      enableSorting: true,
    }),
    columnHelper.accessor(
      (row) =>
        ({
          min: row.loan_amount_min,
          max: row.loan_amount_max,
        }) as AmountRange, // Adding 'as const' to preserve literal types
      {
        id: "amount",
        header: () => {
          return "Amount";
        },
        cell: ({ cell }) => {
          const value = cell.getValue() as AmountRange;
          return (
            <>
              {formatCurrency(value.min)} - {formatCurrency(value.max)}
            </>
          );
        },
        filterFn: (
          row: Row<LoanOffer>,
          columnId: string,
          filterValue: string,
        ) => {
          if (!filterValue) return true;

          const duration = row.getValue(columnId) as AmountRange;
          const min = duration.min;
          const max = duration.max;

          const searchValue = parseFloat(filterValue.replace(/[^0-9.]/g, ""));
          return (
            !Number.isNaN(searchValue) &&
            searchValue >= min &&
            searchValue <= max
          );
        },
      },
    ),
    columnHelper.accessor(
      (row) =>
        ({
          min: row.duration_days_min,
          max: row.duration_days_max,
        }) satisfies DurationRange,
      {
        id: "duration",
        header: () => {
          return "Duration";
        },
        cell: ({ cell }) => {
          const value = cell.getValue() as DurationRange;
          return (
            <>
              {getFormatedStringFromDays(value.min)} -{" "}
              {getFormatedStringFromDays(value.max)}
            </>
          );
        },
        enableColumnFilter: true,
        filterFn: (
          row: Row<LoanOffer>,
          columnId: string,
          filterValue: string,
        ) => {
          if (!filterValue) return true;

          const duration = row.getValue(columnId) as DurationRange;
          const min = duration.min;
          const max = duration.max;

          const searchValue = parseFloat(filterValue.replace(/[^0-9.]/g, ""));
          return (
            !Number.isNaN(searchValue) &&
            searchValue >= min &&
            searchValue <= max
          );
        },
      },
    ),
    columnHelper.accessor("min_ltv", {
      header: () => {
        return "LTV";
      },
      cell: ({ row }) => {
        if (loading) {
          return (
            <div className="bg-muted h-4 w-12 animate-pulse rounded"></div>
          );
        }
        return <>{((row.getValue("min_ltv") as number) * 100).toFixed(0)}%</>;
      },
      enableSorting: true,
    }),
    columnHelper.accessor("interest_rate", {
      header: () => {
        return "Interest";
      },
      cell: ({ row }) => {
        return (
          <>{((row.getValue("interest_rate") as number) * 100).toFixed(1)}%</>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.repayment_plan, {
      id: "repayment_plan",
      header: () => {
        return (
          <div>
            {"Repayment"}
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Bullet loans have a lump-sum payment at the end.
                  <br />
                  Monthly interest loans require regular payments.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
      cell: ({ cell }) => {
        switch (cell.getValue()) {
          case RepaymentPlan.InterestOnlyMonthly:
            return <Badge variant="secondary">{"Monthly"}</Badge>;
          case RepaymentPlan.InterestOnlyWeekly:
            return <Badge variant="secondary">{"Weekly"}</Badge>;
          case RepaymentPlan.Bullet:
            return <Badge variant="secondary">{"Bullet"}</Badge>;
        }
      },
    }),
    columnHelper.accessor((row) => row.loan_asset, {
      id: "Coin",
      header: () => {
        return "Coin";
      },
      cell: ({ cell }) => {
        return (
          <Badge variant="secondary">
            {LoanAssetHelper.print(cell.getValue())}
          </Badge>
        );
      },
    }),
    columnHelper.accessor((row) => row.kyc_link, {
      id: "requirements",
      header: () => {
        return "KYC";
      },
      cell: ({ cell }) => {
        return cell.getValue() ? (
          <Badge variant="success">{"Yes"}</Badge>
        ) : (
          <Badge variant="outline">{"No"}</Badge>
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
                  onActionColumnAction(props.row.original as LoanOffer);
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
          lender: {
            id: "dummy",
            joined_at: new Date(),
            name: "dummy",
            successful_contracts: 1,
            failed_contracts: 0,
            rating: 1,
            timezone: "",
          },
          min_ltv: 0,
          interest_rate: 0,
          loan_amount_min: 0,
          loan_amount_max: 0,
          duration_days_min: 0,
          duration_days_max: 0,
          loan_asset: LoanAsset.USDT_POL,
          origination_fee: [],
          loan_payout: LoanPayout.Direct,
          lender_pk: "dummy",
          repayment_plan: RepaymentPlan.Bullet,
        },
      ] satisfies LoanOffer[];
    }
    return loanOffers;
  }, [loanOffers, loading]);

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
                      <TableHead key={header.id} className="text-foreground">
                        {header.isPlaceholder ? null : (
                          <div
                            className={`flex items-center gap-1 ${
                              header.column.getCanSort()
                                ? "cursor-pointer select-none"
                                : ""
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span className="text-sm font-medium">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </span>
                            {header.column.getCanSort()
                              ? ({
                                  asc: <ArrowUp className="h-4 w-4" />,
                                  desc: <ArrowDown className="h-4 w-4" />,
                                }[header.column.getIsSorted() as string] ?? (
                                  <ArrowUpDown className="h-4 w-4" />
                                ))
                              : undefined}
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
                    className={row.getIsSelected() ? "bg-muted" : ""}
                    onClick={row.getToggleSelectedHandler()}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm font-medium">
                        {loading ? (
                          <div className="bg-muted h-4 w-16 animate-pulse rounded"></div>
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
                    className="text-muted-foreground h-24 text-center"
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
              <div key={i} className="rounded-lg border p-4">
                <div className="bg-muted h-20 animate-pulse rounded"></div>
              </div>
            ))
          ) : table.getRowModel().rows?.length ? (
            table
              .getRowModel()
              .rows.map((row) => (
                <MobileOfferCard
                  key={row.id}
                  offer={row.original}
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
            <div className="text-muted-foreground p-4 text-center">
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
