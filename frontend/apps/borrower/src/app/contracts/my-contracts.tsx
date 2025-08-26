import {
  type ContractsQuery,
  ContractStatus,
  SortField,
  SortOrder,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { MouseEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "react-use";
import {
  ColumnFilter,
  ColumnFilterKey,
  ContractDetailsTable,
} from "./contract-details-table";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

enum ContractStatusFilterType {
  All = "All",
  Open = "Open",
  Closed = "Closed",
}

// Helper function to map ContractStatusFilterType to server-side status arrays
const getStatusFilterArray = (
  filter: ContractStatusFilterType,
): string[] | undefined => {
  switch (filter) {
    case ContractStatusFilterType.Open:
      // Based on isContractOpen function: return all "open" statuses
      return [
        ContractStatus.Approved,
        ContractStatus.CollateralSeen,
        ContractStatus.CollateralConfirmed,
        ContractStatus.PrincipalGiven,
        ContractStatus.RepaymentProvided,
        ContractStatus.RepaymentConfirmed,
        ContractStatus.CollateralRecoverable,
        ContractStatus.DisputeBorrowerStarted,
        ContractStatus.DisputeLenderStarted,
      ];
    case ContractStatusFilterType.Closed:
      // Based on isContractClosed function: return all "closed" statuses
      return [
        ContractStatus.Requested,
        ContractStatus.Undercollateralized,
        ContractStatus.Defaulted,
        ContractStatus.Closing,
        ContractStatus.Closed,
        ContractStatus.ClosedByDefaulting,
        ContractStatus.ClosedByLiquidation,
        ContractStatus.ClosedByRecovery,
        ContractStatus.Extended,
        ContractStatus.Rejected,
        ContractStatus.Cancelled,
        ContractStatus.RequestExpired,
        ContractStatus.ApprovalExpired,
        ContractStatus.CollateralRecoverable,
      ];
    case ContractStatusFilterType.All:
      return undefined; // No filtering
  }
};

// Helper function to map ColumnFilterKey to SortField
const getSortField = (column: ColumnFilterKey): SortField => {
  switch (column) {
    case "updatedAt":
      return SortField.UpdatedAt;
    case "amount":
      return SortField.LoanAmount;
    case "expiry":
      return SortField.ExpiryDate;
    case "interest":
      return SortField.InterestRate;
    case "ltv":
    case "collateral":
      return SortField.CollateralSats;
    case "status":
      return SortField.Status;
    default:
      return SortField.UpdatedAt;
  }
};

function MyContracts() {
  const { getContracts } = useHttpClientBorrower();
  const [contractStatusFilter, setContractStatusFilter] = useState(
    ContractStatusFilterType.Open,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortByColumn, setSortByColumn] =
    useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const { value, error, loading } = useAsync(async () => {
    const statusFilter = getStatusFilterArray(contractStatusFilter);
    const sortField = getSortField(sortByColumn);
    const sortOrder = sortAsc ? SortOrder.Asc : SortOrder.Desc;

    console.log(
      `Fetching contracts with page: ${currentPage}, limit: ${pageSize}, status: ${JSON.stringify(statusFilter)}, sort: ${sortField} ${sortOrder}`,
    );

    const query: ContractsQuery = {
      page: currentPage,
      limit: pageSize,
      status: statusFilter,
      sort_by: sortField,
      sort_order: sortOrder,
    };

    return await getContracts(query);
  }, [currentPage, pageSize, contractStatusFilter, sortByColumn, sortAsc]);

  // TODO: handle error properly
  if (error) {
    console.error(`Failed loading contracts ${JSON.stringify(error)}`);
  }

  const paginationData = value || {
    data: [],
    page: 1,
    limit: pageSize,
    total: 0,
    total_pages: 1,
  };
  const unfilteredContracts = paginationData.data;

  const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  };

  const [shownColumns, setShownColumns] = useState<ColumnFilter>({
    index: true,
    updatedAt: true,
    amount: true,
    expiry: true,
    interest: true,
    ltv: true,
    collateral: true,
    status: true,
    action: true,
  });

  // Function to update columns based on screen width
  const updateColumnsForScreenSize = () => {
    const width = window.innerWidth;

    if (width < BREAKPOINTS.md) {
      // For small screens, show minimal columns
      setShownColumns({
        index: true,
        updatedAt: false,
        amount: true,
        expiry: true,
        interest: false,
        ltv: true,
        collateral: false,
        status: true,
        action: true,
      });
    } else if (width < BREAKPOINTS.lg) {
      // For medium screens, show more columns
      setShownColumns({
        index: true,
        updatedAt: false,
        amount: true,
        expiry: true,
        interest: false,
        ltv: true,
        collateral: true,
        status: true,
        action: true,
      });
    } else {
      // For large screens, show all columns
      setShownColumns({
        index: true,
        updatedAt: true,
        amount: true,
        expiry: true,
        interest: true,
        ltv: true,
        collateral: true,
        status: true,
        action: true,
      });
    }
  };

  // Set initial columns and add resize listener
  // biome-ignore lint/correctness/useExhaustiveDependencies(updateColumnsForScreenSize): changes too often.
  useEffect(() => {
    // Set initial column visibility based on current screen size
    updateColumnsForScreenSize();

    // Add event listener for window resize
    window.addEventListener("resize", updateColumnsForScreenSize);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener("resize", updateColumnsForScreenSize);
    };
  }, []);

  const toggleFilterOutContractDetails = (
    e: MouseEvent<HTMLDivElement>,
    filterName: ColumnFilterKey,
  ) => {
    e.preventDefault();
    setShownColumns((prev) => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };

  function toggleSortByColumn(column: ColumnFilterKey) {
    if (sortByColumn === column) {
      // Same column clicked - toggle sort order
      setSortAsc(!sortAsc);
    } else {
      // New column clicked - set column and default to descending
      setSortByColumn(column);
      setSortAsc(false);
    }
  }

  // No need for client-side filtering/sorting anymore - data comes pre-filtered and sorted from server
  const contracts = unfilteredContracts;

  const handleContractStatusFilterChange = (value: string) => {
    setCurrentPage(1); // Reset to first page when filter changes
    switch (value) {
      case "Open":
        setContractStatusFilter(ContractStatusFilterType.Open);
        break;
      case "Closed":
        setContractStatusFilter(ContractStatusFilterType.Closed);
        break;
      case "All":
        setContractStatusFilter(ContractStatusFilterType.All);
        break;
    }
  };

  return (
    <div className="pb-20">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-6 py-4 md:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My Contracts</h1>
            <Button asChild variant="default">
              <Link to="/requests">New Request</Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-6 md:px-8">
          <div className="mt-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="fields-switch" className="text-sm font-medium">
                Show/hide Fields
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="h-48 w-56">
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.index}
                    onClick={(e) => toggleFilterOutContractDetails(e, "index")}
                  >
                    Index
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.amount}
                    onClick={(e) => toggleFilterOutContractDetails(e, "amount")}
                  >
                    Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.expiry}
                    onClick={(e) => toggleFilterOutContractDetails(e, "expiry")}
                  >
                    Expiry
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.interest}
                    onClick={(e) =>
                      toggleFilterOutContractDetails(e, "interest")
                    }
                  >
                    Interest
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.ltv}
                    onClick={(e) => toggleFilterOutContractDetails(e, "ltv")}
                  >
                    LTV
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.collateral}
                    onClick={(e) =>
                      toggleFilterOutContractDetails(e, "collateral")
                    }
                  >
                    Collateral
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={shownColumns.status}
                    onClick={(e) => toggleFilterOutContractDetails(e, "status")}
                  >
                    Status
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label
                  htmlFor="contracts-switch"
                  className="text-sm font-medium"
                >
                  Show/hide Contracts
                </Label>
              </div>
              <Select
                value={contractStatusFilter}
                onValueChange={(newVal) => {
                  handleContractStatusFilterChange(newVal);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Contracts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="px-6 py-4 md:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground text-sm">
              Loading contracts...
            </div>
          </div>
        ) : (
          <ContractDetailsTable
            shownColumns={shownColumns}
            toggleSortByColumn={toggleSortByColumn}
            sortByColumn={sortByColumn}
            sortAsc={sortAsc}
            contracts={contracts}
            startIndex={(paginationData.page - 1) * paginationData.limit + 1}
          />
        )}

        {/* Pagination */}
        {paginationData.total_pages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Page {paginationData.page} of {paginationData.total_pages} (
              {paginationData.total} total contracts)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage(
                    Math.min(paginationData.total_pages, currentPage + 1),
                  )
                }
                disabled={currentPage >= paginationData.total_pages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyContracts;
