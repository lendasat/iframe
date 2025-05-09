import { useLenderHttpClient } from "@frontend/http-client-lender";
import { Box, Flex, Heading } from "@radix-ui/themes";
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
    <div>
      <Box className={"px-6 py-4 md:px-8"}>
        <Flex gap={"1"} align={"center"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>
            Open loan requests
          </Heading>
        </Flex>
      </Box>
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
          enableActionColumn={true}
          onActionColumnAction={(value) => {
            navigate("/loan-applications/" + value.id);
          }}
        />
      </Box>
    </div>
  );
}

export default AvailableLoanApplications;
