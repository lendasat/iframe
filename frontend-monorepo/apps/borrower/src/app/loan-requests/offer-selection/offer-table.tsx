"use client";

import { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAsset,
  LoanAssetHelper,
} from "@frontend-monorepo/ui-shared";
import {
  Badge,
  Box,
  Button,
  DataList,
  Flex,
  Skeleton,
  Table,
} from "@radix-ui/themes";
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
  return (
    <Box
      className={`p-4 rounded-lg border ${
        selected ? "bg-purple-50" : "bg-white"
      } cursor-pointer`}
      onClick={() => onClick(offer.id)}
    >
      <DataList.Root>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Lender</DataList.Label>
          <DataList.Value className="flex-1 flex justify-end">
            {loading ? (
              <Skeleton>Loading</Skeleton>
            ) : (
              <Lender {...offer.lender} showAvatar={false} />
            )}
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Amounts</DataList.Label>
          <DataList.Value className="flex-1 flex justify-end">
            <Skeleton loading={loading}>
              {formatCurrency(offer.loan_amount_min)} -{" "}
              {formatCurrency(offer.loan_amount_max)}
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Duration</DataList.Label>
          <DataList.Value className="flex-1 flex justify-end">
            <Skeleton loading={loading}>
              {getFormatedStringFromDays(offer.duration_days_min)} -{" "}
              {getFormatedStringFromDays(offer.duration_days_max)}
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Interest Rate</DataList.Label>
          <DataList.Value className="flex-1 flex justify-end">
            <Skeleton loading={loading}>
              {(offer.interest_rate * 100).toFixed(1)}%
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">LTV</DataList.Label>
          <DataList.Value className="flex-1 flex justify-end">
            <Skeleton loading={loading}>
              {(offer.min_ltv * 100).toFixed(0)}%
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Coin</DataList.Label>
          <DataList.Value className="flex-1 flex justify-end">
            <Badge color="purple" size="2">
              <Skeleton loading={loading}>
                {LoanAssetHelper.print(offer.loan_asset)}
              </Skeleton>
            </Badge>
          </DataList.Value>
        </DataList.Item>
        {enableActionColumn && onActionColumnAction && (
          <DataList.Item align="center">
            <DataList.Label minWidth="88px">Pick</DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              <Skeleton loading={loading}>
                <Button onClick={() => onActionColumnAction(offer)}>
                  Select
                </Button>
              </Skeleton>
            </DataList.Value>
          </DataList.Item>
        )}
      </DataList.Root>
    </Box>
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
            !isNaN(searchValue) && searchValue >= min && searchValue <= max
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
            !isNaN(searchValue) && searchValue >= min && searchValue <= max
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
          return <Skeleton loading={true}>Loading</Skeleton>;
        }
        return <>{((row.getValue("min_ltv") as number) * 100).toFixed(0)}%</>;
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
          <Badge color="purple" size={"2"}>
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
          <Badge color="teal" size={"2"}>
            {"YES"}
          </Badge>
        ) : (
          <Badge color="gray" size={"2"}>
            {"No"}
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
          lender_xpub: "none",
        },
      ];
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
    <Box className="w-full">
      <Box className="hidden md:block">
        <Box className="rounded-md border mt-4">
          <Table.Root variant="surface" size={"2"} layout={"auto"}>
            <Table.Header>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Row key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <Table.ColumnHeaderCell
                        key={header.id}
                        className={"text-font dark:text-font-dark"}
                      >
                        {header.isPlaceholder ? null : (
                          <Box
                            {...{
                              className: header.column.getCanSort()
                                ? "cursor-pointer select-none"
                                : "",
                              onClick: header.column.getToggleSortingHandler(),
                            }}
                          >
                            <Flex gap={"1"} align={"center"}>
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
                            </Flex>
                          </Box>
                        )}
                      </Table.ColumnHeaderCell>
                    );
                  })}
                </Table.Row>
              ))}
            </Table.Header>
            <Table.Body>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <Table.Row
                    key={row.id}
                    className={
                      row.getIsSelected() ? "bg-purple-50 dark:purple-100" : ""
                    }
                    onClick={row.getToggleSelectedHandler()}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell
                        key={cell.id}
                        className={
                          row.getIsSelected()
                            ? "text-gray-900"
                            : "text-font dark:text-font-dark"
                        }
                      >
                        {loading ? (
                          <Skeleton loading={loading}>Loading</Skeleton>
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>
      {/* Mobile view */}
      <Box className="block md:hidden">
        <Box className="space-y-4">
          {loading ? (
            // Loading state for mobile
            [...Array(3)].map((_, i) => (
              <Box key={i} className="p-4 rounded-lg border">
                <Skeleton loading={true}>Loading</Skeleton>
              </Box>
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
            <Box className="p-4 text-center text-gray-500">No results.</Box>
          )}
        </Box>
      </Box>

      {/* Pagination */}
      <Box className="flex items-center justify-end space-x-2 py-4">
        <Box className="space-x-2">
          <Button
            variant="outline"
            size="2"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="2"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
