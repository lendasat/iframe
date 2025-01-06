import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { Box } from "@radix-ui/themes";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import { AllContracts } from "./all-contracts";

function AllContractsOverview() {
  const { getContracts } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div className={"text-font dark:text-font-dark"}>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <Box className="h-screen flex-1 max-h-1/2 overflow-auto flex-col pb-5">
            <AllContracts contracts={contracts} />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default AllContractsOverview;
