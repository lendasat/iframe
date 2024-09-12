import { Contract, ContractStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import ContractsComponent from "./contracts";

function MyContracts() {
  const { getContracts } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <div>
            <div className="p-4">
              <ContractsComponent
                loans={contracts.filter((loan) => loan.status !== ContractStatus.Closed)}
              />
            </div>
          </div>
        )}
      />
    </Suspense>
  );
}

export default MyContracts;
