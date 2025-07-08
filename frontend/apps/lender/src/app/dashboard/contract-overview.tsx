import {
  ColumnFilter,
  ColumnFilterKey,
  ContractDetailsTable,
} from "../contracts/contract-details-table";
import { useState } from "react";
import { Contract } from "@frontend/http-client-lender";

interface ContractOverviewProps {
  contracts: Contract[];
}

export const ContractOverview = ({
  contracts: unfilteredContracts,
}: ContractOverviewProps) => {
  const shownColumns: ColumnFilter = {
    updatedAt: true,
    amount: true,
    expiry: true,
    interest: true,
    ltv: true,
    collateral: true,
    status: true,
    action: true,
  };

  const [sortByColumn, setSortByColumn] =
    useState<ColumnFilterKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const contracts = unfilteredContracts.sort((a, b) => {
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

  function toggleSortByColumn(column: ColumnFilterKey) {
    setSortByColumn(column);
    setSortAsc(!sortAsc);
  }

  return (
    <div className="py-4">
      <ContractDetailsTable
        shownColumns={shownColumns}
        toggleSortByColumn={toggleSortByColumn}
        sortByColumn={sortByColumn}
        sortAsc={sortAsc}
        contracts={contracts}
      />
    </div>
  );
};
