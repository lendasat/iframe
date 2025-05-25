import {
  LoanProductOption,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import { Box, ScrollArea } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import DashHeader from "../components/DashHeader";
import { LoanOfferTable } from "./offer-selection/offer-table";
import { LoanAssetHelper, } from "@frontend/ui-shared";

function AvailableOffers() {
  const { getDirectLoanOffers } = useHttpClientBorrower();
  const navigate = useNavigate();

  const { loading, value } = useAsync(async () => {
    return await getDirectLoanOffers();
  });

  const filteredLoanOffers = value || [];

  return (
    <ScrollArea className="h-screen" type="always" scrollbars="vertical">
      <DashHeader label="Available Offers" />
      {/*TODO: re-implement filters if needed */}
      <Box className="pt-3" px={"6"} pb={"8"}>
        <LoanOfferTable
          loading={loading}
          loanOffers={filteredLoanOffers}
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
            let product = LoanProductOption.StableCoins;
            if (LoanAssetHelper.isFiat(value.loan_asset)) {
              product = LoanProductOption.Fiat;
            }
            navigate(
              `/requests?amount=${value.loan_amount_min}&duration=${value.duration_days_min}&product=${product}&offer=${value.id}`,
            );
          }}
        />
      </Box>
    </ScrollArea>
  );
}

export default AvailableOffers;
