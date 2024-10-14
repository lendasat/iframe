import { Contract, ContractStatus, useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import ContractsComponent from "./contracts";
import { Box } from "@radix-ui/themes";

function MyContracts() {
  const { getContracts } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <Box>
            <ContractsComponent
              loans={contracts.filter((loan) => loan.status !== ContractStatus.Closed)}
            />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default MyContracts;
