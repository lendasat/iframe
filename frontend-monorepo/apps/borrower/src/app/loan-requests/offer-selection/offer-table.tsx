"use client";

import { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency, getFormatedStringFromDays, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Badge, Button, Skeleton, Table } from "@radix-ui/themes";
import {
  ColumnFiltersState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import { useMemo } from "react";
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from "react-icons/lu";
import { Lender } from "../../request-loan/lender";

const columnHelper = createColumnHelper<LoanOffer>();

interface DataTableDemoProps {
  loanOffers: LoanOffer[];
  loading: boolean;
}

export function DataTableDemo({ loanOffers, loading }: DataTableDemoProps) {
  const columns = [
    columnHelper.accessor("lender", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className={"text-font dark:text-font-dark"}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Lender
            {column.getIsSorted() === "asc"
              ? <LuArrowUp />
              : column.getIsSorted() === "desc"
              ? <LuArrowDown />
              : <LuArrowUpDown />}
          </Button>
        );
      },
      cell: ({ row }) => {
        if (loading) {
          return <Skeleton loading={true}>Loading</Skeleton>;
        }
        return <Lender {...row.getValue("lender")} showAvatar={true} />;
      },
      enableSorting: true,
    }),
    columnHelper.accessor(
      row => `${formatCurrency(row.loan_amount_min)} - ${formatCurrency(row.loan_amount_max)}`,
      {
        id: "amount",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              className={"text-font dark:text-font-dark"}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Amount
              {column.getIsSorted() === "asc"
                ? <LuArrowUp />
                : column.getIsSorted() === "desc"
                ? <LuArrowDown />
                : <LuArrowUpDown />}
            </Button>
          );
        },
        cell: ({ cell }) => {
          if (loading) {
            return <Skeleton loading={true}>Loading</Skeleton>;
          }
          return <>{cell.getValue()}</>;
        },
      },
    ),
    columnHelper.accessor(
      row =>
        `${getFormatedStringFromDays(row.duration_days_min)} - ${getFormatedStringFromDays(row.duration_days_max)}`,
      {
        id: "duration",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              className={"text-font dark:text-font-dark"}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Duration
              {column.getIsSorted() === "asc"
                ? <LuArrowUp />
                : column.getIsSorted() === "desc"
                ? <LuArrowDown />
                : <LuArrowUpDown />}
            </Button>
          );
        },
        cell: ({ cell }) => {
          if (loading) {
            return <Skeleton loading={true}>Loading</Skeleton>;
          }
          return <>{cell.getValue()}</>;
        },
        enableColumnFilter: true,
      },
    ),
    columnHelper.accessor("min_ltv", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className={"text-font dark:text-font-dark"}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            LTV
            {column.getIsSorted() === "asc"
              ? <LuArrowUp />
              : column.getIsSorted() === "desc"
              ? <LuArrowDown />
              : <LuArrowUpDown />}
          </Button>
        );
      },
      cell: ({ row }) => {
        if (loading) {
          return <Skeleton loading={true}>Loading</Skeleton>;
        }
        return <>{(row.getValue("min_ltv") as number * 100).toFixed(0)}%</>;
      },
      enableSorting: true,
    }),
    columnHelper.accessor("interest_rate", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className={"text-font dark:text-font-dark"}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Interest Rate
            {column.getIsSorted() === "asc"
              ? <LuArrowUp />
              : column.getIsSorted() === "desc"
              ? <LuArrowDown />
              : <LuArrowUpDown />}
          </Button>
        );
      },
      cell: ({ row }) => {
        if (loading) {
          return <Skeleton loading={true}>Loading</Skeleton>;
        }
        let element = <>{(row.getValue("interest_rate") as number * 100).toFixed(0)}%</>;
        if (loading) {
          return <Skeleton>{element}</Skeleton>;
        }

        return element;
      },
      enableSorting: true,
    }),
    columnHelper.accessor(
      row => StableCoinHelper.mapFromBackend(row.loan_asset_chain, row.loan_asset_type),
      {
        id: "Coin",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              className={"text-font dark:text-font-dark"}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Coin
              {column.getIsSorted() === "asc"
                ? <LuArrowUp />
                : column.getIsSorted() === "desc"
                ? <LuArrowDown />
                : <LuArrowUpDown />}
            </Button>
          );
        },
        cell: ({ cell }) => {
          if (loading) {
            return <Skeleton loading={true}>Loading</Skeleton>;
          }
          return <Badge color="purple" size={"2"}>{StableCoinHelper.print(cell.getValue())}</Badge>;
        },
      },
    ),
  ];

  const data = useMemo(() => {
    if (loading) {
      return [{
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
        loan_asset_type: "Usdc",
        loan_asset_chain: "Ethereum",
        origination_fee: [],
      }];
    }
    return loanOffers;
  }, [loanOffers]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableFilters: false,
    getRowId: row => row.id,
    enableMultiRowSelection: false,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });
  console.log(`rowSelection ${JSON.stringify(rowSelection)}`);

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
      </div>
      <div className="rounded-md border">
        <Table.Root variant="surface" size={"2"} layout={"auto"}>
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Row key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <Table.ColumnHeaderCell key={header.id} className={"text-font dark:text-font-dark"}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </Table.ColumnHeaderCell>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows?.length
              ? (
                table.getRowModel().rows.map((row) => (
                  <Table.Row
                    key={row.id}
                    className={row.getIsSelected() ? "bg-purple-50" : ""}
                    onClick={row.getToggleSelectedHandler()}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
              )
              : (
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
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length}{" "}
          row(s) selected.
        </div>
        <div className="space-x-2">
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
        </div>
      </div>
    </div>
  );
}
