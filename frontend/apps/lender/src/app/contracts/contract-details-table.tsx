import {
  actionFromStatus,
  type Contract,
  contractStatusToLabelString,
  LiquidationStatus,
} from "@frontend/http-client-lender";
import {
  formatCurrency,
  LoanAssetHelper,
  LtvProgressBar,
} from "@frontend/ui-shared";
import { useNavigate } from "react-router-dom";
import { formatDistance } from "date-fns";
import { Info } from "lucide-react";
import { CaretSortIcon } from "@radix-ui/react-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn";
import { Button } from "@frontend/shadcn";
import { Badge } from "@frontend/shadcn";
import { Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";

export type ColumnFilterKey =
  | "updatedAt"
  | "amount"
  | "expiry"
  | "interest"
  | "ltv"
  | "collateral"
  | "status"
  | "action";

export type ColumnFilter = Record<ColumnFilterKey, boolean>;

interface ColumnHeaderProps {
  toggleSortByColumn: (column: ColumnFilterKey) => void;
  sortByColumn: ColumnFilterKey;
  currentColumn: ColumnFilterKey;
  sortAsc: boolean;
  label: string;
  className?: string;
}

const ColumnHeader = ({
  toggleSortByColumn,
  sortByColumn,
  currentColumn,
  label,
  className = "",
}: ColumnHeaderProps) => {
  const isActive = sortByColumn === currentColumn;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 p-0 font-medium ${className} ${
        isActive ? "text-foreground" : "text-muted-foreground"
      }`}
      onClick={() => toggleSortByColumn(currentColumn)}
    >
      {label}
      <CaretSortIcon className="ml-1 h-4 w-4" />
    </Button>
  );
};

export interface ContractDetailsTableProps {
  shownColumns: ColumnFilter;
  toggleSortByColumn: (column: ColumnFilterKey) => void;
  sortByColumn: ColumnFilterKey;
  sortAsc: boolean;
  contracts: Contract[];
}

export const ContractDetailsTable = ({
  shownColumns,
  toggleSortByColumn,
  sortByColumn,
  sortAsc,
  contracts,
}: ContractDetailsTableProps) => {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {shownColumns.amount && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="amount"
                label="Amount"
              />
            </TableHead>
          )}
          {shownColumns.expiry && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="expiry"
                label="Expiry"
              />
            </TableHead>
          )}
          {shownColumns.interest && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="interest"
                label="Interest"
              />
            </TableHead>
          )}
          {shownColumns.ltv && (
            <TableHead className="min-w-[100px] text-center">
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="ltv"
                label="LTV"
                className="justify-center"
              />
            </TableHead>
          )}
          {shownColumns.collateral && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="collateral"
                label="Collateral"
              />
            </TableHead>
          )}
          {shownColumns.status && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="status"
                label="Status"
              />
            </TableHead>
          )}
          {shownColumns.updatedAt && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="updatedAt"
                label="Last Update"
              />
            </TableHead>
          )}
          {shownColumns.action && (
            <TableHead>
              <ColumnHeader
                toggleSortByColumn={toggleSortByColumn}
                sortByColumn={sortByColumn}
                sortAsc={sortAsc}
                currentColumn="action"
                label="Action"
              />
            </TableHead>
          )}
        </TableRow>
      </TableHeader>

      <TableBody>
        {contracts.length === 0 && (
          <TableRow>
            <TableCell colSpan={8}>
              <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertTitle>Info</AlertTitle>
                <AlertDescription>No contracts found.</AlertDescription>
              </Alert>
            </TableCell>
          </TableRow>
        )}

        {contracts.map((contract) => {
          const collateral_btc = contract.collateral_sats / 100000000;

          let contractStatus = contractStatusToLabelString(contract.status);
          const firstMarginCall =
            contract.liquidation_status === LiquidationStatus.FirstMarginCall;
          const secondMarginCall =
            contract.liquidation_status === LiquidationStatus.SecondMarginCall;
          const liquidated =
            contract.liquidation_status === LiquidationStatus.Liquidated;

          if (firstMarginCall) {
            contractStatus = "First Margin Call";
          }
          if (secondMarginCall) {
            contractStatus = "Second Margin Call";
          }
          if (liquidated) {
            contractStatus = "Liquidated";
          }

          return (
            <TableRow key={contract.id}>
              {shownColumns.amount && (
                <TableCell className="font-medium">
                  {formatCurrency(
                    contract.loan_amount,
                    LoanAssetHelper.toCurrency(contract.loan_asset),
                  )}
                </TableCell>
              )}
              {shownColumns.expiry && (
                <TableCell>
                  {contract.expiry?.toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
              )}
              {shownColumns.interest && (
                <TableCell>
                  {(contract.interest_rate * 100).toFixed(2)}%
                </TableCell>
              )}
              {shownColumns.ltv && (
                <TableCell>
                  <LtvProgressBar
                    collateralSats={contract.collateral_sats}
                    balanceOutstanding={contract.balance_outstanding}
                    loanAsset={contract.loan_asset}
                  />
                </TableCell>
              )}
              {shownColumns.collateral && (
                <TableCell>{collateral_btc} BTC</TableCell>
              )}
              {shownColumns.status && (
                <TableCell>
                  <Badge variant={"default"}>{contractStatus}</Badge>
                </TableCell>
              )}
              {shownColumns.updatedAt && (
                <TableCell>
                  {formatDistance(contract.updated_at, new Date(), {
                    addSuffix: true,
                  })}
                </TableCell>
              )}
              {shownColumns.action && (
                <TableCell>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/my-contracts/${contract.id}`)}
                    className="hidden font-semibold md:block"
                  >
                    {actionFromStatus(contract)}
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={() => navigate(`/my-contracts/${contract.id}`)}
                    className="md:hidden"
                  >
                    <Info className={"h-6 w-6"} />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
