import { Contract, ContractStatus, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import ContractsComponent from "./loans";
import { Box } from "@radix-ui/themes";

function MyLoans() {
  const { getContracts } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <Box >
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
