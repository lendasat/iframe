import { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Lender } from "./lender";
import { StableCoinHelper } from "./stable-coin";
import { Badge, Box, Button, Flex, Grid, Text } from "@radix-ui/themes";
import { BsThreeDotsVertical } from "react-icons/bs";

interface LoanOfferProps {
  loanOffer: LoanOffer;
  onRequest: (loanOffer: LoanOffer) => void;
}

export function LoanOfferComponent({ loanOffer, onRequest }: LoanOfferProps) {
  const coin = StableCoinHelper.mapFromBackend(loanOffer.loan_asset_chain, loanOffer.loan_asset_type)!;
  const [loadingState, setLoadingState] = React.useState<boolean>(false)
  return (
    <div className="pl-5 pr-6 md:pl-7 md:pr-8 py-3 border-b border-black/5 flex md:gap-2 items-center">
      <Grid
        className="grid-cols-4 md:grid-cols-6 xl:grid-cols-8 items-center grow text-font">
        <Box
          className="col-span-1 xl:col-span-2"
        >
          <Lender {...loanOffer.lender} />
        </Box>
        <Box className="flex justify-center col-span-2 md:col-span-1">
          <Text size={'1'} weight={'medium'}>
            <CurrencyFormatter value={loanOffer.loan_amount_min} /> -{" "}
            <CurrencyFormatter value={loanOffer.loan_amount_max} />
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={'1'} weight={'medium'}>
            {loanOffer.duration_months_min} - {loanOffer.duration_months_max} months
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={'1'} weight={'medium'}>
            {loanOffer.min_ltv * 100}%
          </Text>
        </Box>

        <Box className="flex justify-center">
          <Text size={'1'} weight={'medium'}>
            {loanOffer.interest_rate * 100}%
          </Text>
        </Box>

        <Box className="hidden md:flex justify-center">
          <Text size={'1'} weight={'medium'}>
            <Badge color="purple" size={'2'}>{StableCoinHelper.print(coin)}</Badge>
          </Text>
        </Box>
        <Box className="hidden xl:flex justify-center">
          <Button
            size={'3'}
            loading={loadingState}
            variant="solid"
            className="bg-btn text-white"
            onClick={() => {
              setLoadingState(true)
              setTimeout(() => {
                setLoadingState(false)
                onRequest(loanOffer)
              }, 1000)
            }}
          >
            <Text
              size={'2'}
              className="font-semibold">
              Request Loan
            </Text>
          </Button>
        </Box>
      </Grid>
      <BsThreeDotsVertical className="xl:hidden" />
    </div>
  );
}
