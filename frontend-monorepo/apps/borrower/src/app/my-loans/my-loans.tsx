import { Contract, ContractStatus, useAuth } from "@frontend-monorepo/http-client";
import { Suspense } from "react";
import { Await, useNavigate } from "react-router-dom";
import CollapsibleComponent from "../collapsible";
import ContractsComponent from "./loans";
import LoansHistoryComponent from "./loans-history";

function MyLoans() {
  const { getContracts } = useAuth();

  const navigate = useNavigate();
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
                onRepay={(loan_id) => {
                  navigate(`repay/${loan_id}`);
                }}
                onCollateralize={(loan_id) => {
                  navigate(`collateralize/${loan_id}`);
                }}
              />
            </div>
            <div className="px-4">
              <CollapsibleComponent
                title={"History"}
                children={
                  <LoansHistoryComponent loans={contracts.filter((loan) => loan.status === ContractStatus.Closed)} />
                }
              />
            </div>
          </div>
        )}
      />
    </Suspense>
  );
}

export default MyLoans;
