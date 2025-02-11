import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { Box } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import DashHeader from "../components/DashHeader";
import { LoanOfferTable } from "../loan-requests/offer-selection/offer-table";

function AvailableOffers() {
  const { getLoanOffers } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const { loading, value } = useAsync(async () => {
    return await getLoanOffers();
  });

  const loanOffers = value || [];

  return (
    <div>
      <DashHeader label="Available Offers" />
      {/*TODO: re-implement filters if needed */}
      <Box className="pt-3" px={"6"}>
        <LoanOfferTable
          loading={loading}
          loanOffers={loanOffers}
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
            navigate(
              `/requests?amount=${value.loan_amount_min}&duration=${value.duration_days_min}&product=stable_coins&offer=${value.id}`,
            );
          }}
        />
      </Box>
    </div>
  );
}

export default AvailableOffers;
