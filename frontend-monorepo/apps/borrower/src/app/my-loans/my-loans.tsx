import { Contract, ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import ContractsComponent from "./loans";

function MyLoans() {
  const { getContracts } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <div className="p-4">
            <ContractsComponent
              loans={contracts.filter((
                loan,
              ) => (loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Rejected))}
            />
          </div>
        )}
      />
    </Suspense>
  );
}

export default MyLoans;
