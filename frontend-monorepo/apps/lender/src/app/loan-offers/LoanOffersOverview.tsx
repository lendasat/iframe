import { useLenderHttpClient } from "@frontend-monorepo/http-client-lender";
import { Box, Flex, Heading } from "@radix-ui/themes";
import { useAsync } from "react-use";
import { LoanOffersTable } from "./LoanOffersTable";

export const LoanOffersOverview = () => {
  const { getAllLoanOffers } = useLenderHttpClient();

  const { value } = useAsync(async () => {
    return getAllLoanOffers();
  });

  // TODO: error handling and loading handling

  const loanOffers = value || [];

  return (
    <Box className={"pb-20"}>
      <Box className={"px-6 md:px-8 py-4"}>
        <Flex gap={"1"} align={"center"}>
          <Heading className={"text-font dark:text-font-dark"} size={"6"}>All Loan Offers</Heading>
        </Flex>
      </Box>

      <Box className={"px-6 md:px-8 py-4"}>
        <LoanOffersTable offers={loanOffers} />
      </Box>
    </Box>
  );
};
