import { useLenderHttpClient } from "@frontend/http-client-lender";
import { ScrollArea } from "@frontend/shadcn";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import { LoanApplicationTable } from "./loan-application-table";

function AvailableLoanApplications() {
  const { getLoanApplications } = useLenderHttpClient();
  const navigate = useNavigate();

  const { loading, value } = useAsync(async () => {
    return await getLoanApplications();
  });

  const loanApplications = value || [];

  return (
    <ScrollArea className="h-[calc(100vh-4rem)] w-full">
      <div className="px-6 py-4 md:px-8">
        <div className="flex gap-1 items-center">
          <h2 className="text-2xl font-semibold text-font dark:text-font-dark">
            Open loan requests
          </h2>
        </div>
      </div>
      {/*TODO: re-implement filters if needed */}
      <div className="pt-3 px-6 pb-6">
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
          enableActionColumn={true}
          onActionColumnAction={(value) => {
            navigate("/loan-applications/" + value.id);
          }}
        />
      </div>
    </ScrollArea>
  );
}

export default AvailableLoanApplications;
