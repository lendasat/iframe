"use client";

import {
  LoanApplication,
  LoanApplicationStatus,
  LoanApplicationStatusHelper,
  LoanType,
} from "@frontend/http-client-lender";
import {
  formatCurrency,
  getFormatedStringFromDays,
  LoanAsset,
  LoanAssetHelper,
} from "@frontend/ui-shared";
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
    <Box
      className={`rounded-lg border p-4 ${
        selected ? "bg-purple-50" : "bg-white"
      } cursor-pointer`}
      onClick={() => onClick(application.id)}
    >
      <DataList.Root>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Borrower</DataList.Label>
          <DataList.Value className="flex flex-1 justify-end">
            <Skeleton loading={loading}>{application.borrower.name}</Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Amount</DataList.Label>
          <DataList.Value className="flex flex-1 justify-end">
            <Skeleton loading={loading}>
              {formatCurrency(application.loan_amount)}
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Duration</DataList.Label>
          <DataList.Value className="flex flex-1 justify-end">
            <Skeleton loading={loading}>
              {getFormatedStringFromDays(application.duration_days)}
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Interest Rate</DataList.Label>
          <DataList.Value className="flex flex-1 justify-end">
            <Skeleton loading={loading}>
              {(application.interest_rate * 100).toFixed(1)}%
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">LTV</DataList.Label>
          <DataList.Value className="flex flex-1 justify-end">
            <Skeleton loading={loading}>
              {(application.ltv * 100).toFixed(0)}%
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Coin</DataList.Label>
          <DataList.Value className="flex flex-1 justify-end">
            <Badge color="purple" size="2">
              <Skeleton loading={loading}>
                {LoanAssetHelper.print(application.loan_asset)}
              </Skeleton>
            </Badge>
          </DataList.Value>
        </DataList.Item>
        {enableActionColumn && onActionColumnAction && (
          <DataList.Item align="center">
            <DataList.Label minWidth="88px">Pick</DataList.Label>
            <DataList.Value className="flex flex-1 justify-end">
              <Skeleton loading={loading}>
                <Button onClick={() => onActionColumnAction(application)}>
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
        return <>{value.name}</>;
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
        return <>{formatCurrency(value)}</>;
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
          return <Skeleton loading={true}>Loading</Skeleton>;
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
          <Badge color="purple" size={"2"}>
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
          <Badge color="green" size={"2"}>
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
          },
          borrower_loan_address: "dummy",
          borrower_btc_address: "dummy",
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
    <Box className="w-full">
      <Box className="hidden md:block">
        <Box className="mt-4 rounded-md border">
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
                      row.getIsSelected() ? "dark:purple-100 bg-purple-50" : ""
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
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <Box key={i} className="rounded-lg border p-4">
                <Skeleton loading={true}>Loading</Skeleton>
              </Box>
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
            <Box className="p-4 text-center text-font dark:text-font-dark">
              No results.
            </Box>
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
