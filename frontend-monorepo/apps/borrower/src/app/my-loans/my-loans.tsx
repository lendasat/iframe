import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box } from "@radix-ui/themes";
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
          <Box>
            <ContractsComponent
              loans={contracts.filter((
                loan,
              ) => (loan.status !== ContractStatus.Closed && loan.status !== ContractStatus.Rejected))}
            />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default MyLoans;
