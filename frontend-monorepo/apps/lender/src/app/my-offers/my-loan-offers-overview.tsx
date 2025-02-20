import { useLenderHttpClient } from "@lendasat/http-client-lender";
import { Box, Flex, Heading } from "@radix-ui/themes";
import { useAsync } from "react-use";
import { MyLoanOffersTable } from "./MyLoanOffersTable";

export enum TableSortBy {
  Amount = "Amount",
  Duration = "Duration",
  Ltv = "Ltv",
  Interest = "Interest",
}

function MyLoanOffersOverview() {
  const { getMyLoanOffers } = useLenderHttpClient();

  const { value } = useAsync(async () => {
    return getMyLoanOffers();
  });
  // TODO: handle loading and error from fetching

  const loanOffers = value || [];

  return (
    <Box className={"pb-20"}>
      <Box className={"px-6 md:px-8 py-4"}>
        <Flex gap={"1"} align={"center"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>
            My Loan Offers
          </Heading>
        </Flex>
      </Box>

      <Box className={"px-6 md:px-8 py-4"}>
        <MyLoanOffersTable offers={loanOffers} />
      </Box>
    </Box>
  );
}

export default MyLoanOffersOverview;
