import { useBorrowerHttpClient } from "@frontend/http-client-borrower";
import { Box } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import DashHeader from "../components/DashHeader";
import { LoanApplicationTable } from "./loan-application-table";

function AvailableLoanApplications() {
  const { getLoanApplications } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const { loading, value } = useAsync(async () => {
    return await getLoanApplications();
  });

  const loanApplications = value || [];

  return (
    <div>
      <DashHeader label="My loan applications" />
      {/*TODO: re-implement filters if needed */}
      <Box className="pt-3" px={"6"}>
        <LoanApplicationTable
          loading={loading}
          loanApplications={loanApplications}
          columnFilters={[]}
          onColumnFiltersChange={() => {
            // ignored
          }}
          enableRowSelection={false}
          onOfferSelect={() => {
            // ignored
          }}
          selectedOfferId={undefined}
          enableActionColumn={false}
          onActionColumnAction={(value) => {
            // TODO: implement edit for application
          }}
        />
      </Box>
    </div>
  );
}

export default AvailableLoanApplications;
