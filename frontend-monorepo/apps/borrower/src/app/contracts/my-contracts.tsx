import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import {
  ContractStatus,
  contractStatusToLabelString,
} from "@frontend/http-client-borrower";
import { ALL_CONTRACT_STATUSES } from "@frontend/http-client-lender";
import { useState, MouseEvent, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "react-use";
import {
  ColumnFilter,
  ColumnFilterKey,
  ContractDetailsTable,
} from "./contract-details-table";
import { Button, ScrollArea } from "@frontend/shadcn";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@frontend/shadcn";
import { Label } from "@frontend/shadcn";
import { Card, CardContent, CardHeader } from "@frontend/shadcn";
import { SlidersHorizontal } from "lucide-react";

function MyContracts() {
  const { getContracts } = useBorrowerHttpClient();

  const { value, error } = useAsync(async () => {
    return getContracts();
  });

  // TODO: handle error properly
  if (error) {
    console.error(`Failed loading contracts ${JSON.stringify(error)}`);
  }

  const unfilteredContracts = value || [];

  const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  };

  const [shownColumns, setShownColumns] = useState<ColumnFilter>({
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

  const [contractStatusFilter, setContractStatusFilter] = useState<
    ContractStatus[]
  >([
    ContractStatus.Requested,
    ContractStatus.RenewalRequested,
    ContractStatus.Approved,
    ContractStatus.Approved,
    ContractStatus.CollateralSeen,
    ContractStatus.CollateralConfirmed,
    ContractStatus.PrincipalGiven,
    ContractStatus.RepaymentProvided,
    ContractStatus.RepaymentConfirmed,
    ContractStatus.DisputeBorrowerStarted,
    ContractStatus.DisputeBorrowerResolved,
    ContractStatus.DisputeLenderStarted,
    ContractStatus.DisputeLenderResolved,
    ContractStatus.Defaulted,
    ContractStatus.Undercollateralized,
  ]);
  const [sortByColumn, setSortByColumn] =
    useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

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

  const toggleContractStatusFilter = (
    e: MouseEvent<HTMLDivElement>,
    filterName: ContractStatus,
  ) => {
    e.preventDefault();

    setContractStatusFilter((prev) =>
      prev.includes(filterName)
        ? prev.filter((status) => status !== filterName)
        : [...prev, filterName],
    );
  };

  function toggleSortByColumn(column: ColumnFilterKey) {
    setSortByColumn(column);
    setSortAsc(!sortAsc);
  }

  const contracts = unfilteredContracts
    .filter((contract) => {
      return contractStatusFilter.includes(contract.status);
    })
    .sort((a, b) => {
      // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
      let dif;
      switch (sortByColumn) {
        case "updatedAt":
          dif = a.updated_at.getTime() - b.updated_at.getTime();
          break;
        case "amount":
          dif = a.loan_amount - b.loan_amount;
          break;
        case "expiry":
          dif = a.expiry.getTime() - b.expiry.getTime();
          break;
        case "interest":
          dif = a.interest_rate - b.interest_rate;
          break;
        case "ltv":
          // TODO: this is wrong, we should calculate the current LTV
          dif = a.initial_ltv - b.initial_ltv;
          break;
        case "collateral":
          dif = a.collateral_sats - b.collateral_sats;
          break;
        default:
          dif = a.status.localeCompare(b.status);
          break;
      }
      return sortAsc ? dif : -dif;
    });

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
                <DropdownMenuContent align="end" className="w-56 h-48">
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
                <span className="text-xs font-medium">
                  ({contracts.length}/{unfilteredContracts.length} displayed)
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 sm:h-48 h-80">
                  <ScrollArea>
                    {ALL_CONTRACT_STATUSES.map((contractStatus) => (
                      <DropdownMenuCheckboxItem
                        id={`status-${contractStatus}`}
                        checked={contractStatusFilter.includes(contractStatus)}
                        onClick={(e) =>
                          toggleContractStatusFilter(e, contractStatus)
                        }
                      >
                        {contractStatusToLabelString(contractStatus)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="px-6 py-4 md:px-8">
        <ContractDetailsTable
          shownColumns={shownColumns}
          toggleSortByColumn={toggleSortByColumn}
          sortByColumn={sortByColumn}
          sortAsc={sortAsc}
          contracts={contracts}
        />
      </div>
    </div>
  );
}

export default MyContracts;
