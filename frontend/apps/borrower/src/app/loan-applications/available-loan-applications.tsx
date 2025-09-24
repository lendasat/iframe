import { useHttpClientBorrower } from "@frontend/http-client-borrower";
import { Link } from "react-router-dom";
import { useAsyncRetry } from "react-use";
import { LoanApplicationTable } from "./loan-application-table";
import { Button } from "@frontend/shadcn";

function AvailableLoanApplications() {
  const { getLoanApplications } = useHttpClientBorrower();

  const { loading, value, retry } = useAsyncRetry(async () => {
    return await getLoanApplications();
  });

  const loanApplications = value || [];

  return (
    <div>
      <div className="flex justify-end m-4 mx-8">
        <Button asChild variant="default" className="justify-end">
          <Link to="/loan-application">New Request</Link>
        </Button>
      </div>
      {/*TODO: re-implement filters if needed */}
      <div className="px-6 pt-3">
        <LoanApplicationTable
          loading={loading}
          loanApplications={loanApplications}
          triggerRefresh={retry}
        />
      </div>
    </div>
  );
}

export default AvailableLoanApplications;
