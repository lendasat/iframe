import type { Contract } from "@lendasat/http-client-lender";
import { useLenderHttpClient } from "@lendasat/http-client-lender";
import { Box } from "@radix-ui/themes";
import { Suspense } from "react";
import { Await } from "react-router-dom";
import { AllContracts } from "./all-contracts";

function MyContracts() {
  const { getContracts } = useLenderHttpClient();

  return (
    <Suspense>
      <Await
        resolve={getContracts()}
        errorElement={
          <div className={"text-font dark:text-font-dark"}>
            Could not load contracts
          </div>
        }
        children={(contracts: Awaited<Contract[]>) => (
          <Box className="h-screen flex-1 max-h-1/2 overflow-auto flex-col pb-5">
            <AllContracts contracts={contracts} />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default MyContracts;
