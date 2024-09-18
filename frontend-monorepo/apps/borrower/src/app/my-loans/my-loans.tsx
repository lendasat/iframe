import { Contract, ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import CollapsibleComponent from "../collapsible";
import ContractsComponent from "./loans";
import LoansHistoryComponent from "./loans-history";

function MyLoans() {
  const { getContracts } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <div>
            <div className="p-4">
              <ContractsComponent
                loans={contracts.filter((
                  loan,
                ) => (loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Rejected))}
              />
            </div>
            <div className="px-4">
              <CollapsibleComponent
                title={"History"}
                children={
                  <LoansHistoryComponent
                    loans={contracts.filter((
                      loan,
                    ) => (loan.status === ContractStatus.Closed || loan.status === ContractStatus.Rejected))}
                  />
                }
              />
            </div>
          </div>
        )}
      />
    </Suspense>
  );
}

export default MyLoans;
