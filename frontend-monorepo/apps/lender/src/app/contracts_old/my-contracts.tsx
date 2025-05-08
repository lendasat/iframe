import type { Contract } from "@frontend/http-client-lender";
import { useLenderHttpClient } from "@frontend/http-client-lender";
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
          <Box className="max-h-1/2 h-screen flex-1 flex-col overflow-auto pb-5">
            <AllContracts contracts={contracts} />
          </Box>
        )}
      />
    </Suspense>
  );
}

export default MyContracts;
