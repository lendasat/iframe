import type { Contract } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box } from "@radix-ui/themes";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import ContractList from "./ContractList";

function MyContracts() {
  const { getContracts } = useBorrowerHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={<div className={"text-font dark:text-font-dark"}>Could not load contracts</div>}
        children={(contracts: Awaited<Contract[]>) => (
          <Box>
            <ContractList contracts={contracts} />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default MyContracts;
