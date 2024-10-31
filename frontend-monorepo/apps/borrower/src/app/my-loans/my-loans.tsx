import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
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
            <ContractsComponent loans={contracts} />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default MyLoans;
