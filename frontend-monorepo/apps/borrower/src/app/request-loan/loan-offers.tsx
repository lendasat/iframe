import { faChevronDown, faChevronUp, faMinus, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { useState } from "react";
import { LoanOfferComponent } from "./loan-offer";
import { Box, Button, Flex, Grid, Text } from "@radix-ui/themes";
import { IoCaretDownOutline, IoCaretUp } from "react-icons/io5";
import { PiWarningOctagon } from "react-icons/pi";

enum Sort {
  NONE = "NONE",
  ASC = "ASC",
  DESC = "DESC",
}

class SortHelper {
  static getIcon(sort: Sort): IconDefinition {
    switch (sort) {
      case Sort.NONE:
        return faMinus;
      case Sort.ASC:
        return faChevronDown;
      case Sort.DESC:
        return faChevronUp;
    }
  }

  static getNextSort(sort: Sort): Sort {
    switch (sort) {
      case Sort.NONE:
        return Sort.ASC;
      case Sort.ASC:
        return Sort.DESC;
      case Sort.DESC:
        return Sort.NONE;
    }
  }

  static sort(sort: Sort, a: number, b: number): number {
    switch (sort) {
      case Sort.NONE:
        return 0;
      case Sort.ASC:
        return a - b;
      case Sort.DESC:
        return b - a;
    }
  }
}

interface LoanOffersComponentProps {
  loanOffers: LoanOffer[];
  onRequest: (loanOffer: LoanOffer) => void;
}

function LoanOffersComponent({ loanOffers, onRequest }: LoanOffersComponentProps) {
  const [amountSort, setAmountSort] = useState<Sort>(Sort.NONE);
  const [durationSort, setDurationSort] = useState<Sort>(Sort.NONE);
  const [ltvSort, setLTVSort] = useState<Sort>(Sort.NONE);
  const [interestSort, setInterestSort] = useState<Sort>(Sort.NONE);

  return (
    <>
      <Box className="bg-active-nav/15 py-1 px-6 md:px-8 flex items-center">
        <Grid
          className="grid-cols-4 md:grid-cols-6 xl:grid-cols-8 items-center grow">
          <Box
            className="mb-1 col-span-1 xl:col-span-2">
            <Text
              size={'1'}
              weight={'medium'}
              className="text-black/50"
            >
              Lender
            </Text>
          </Box>
          <Box
            className="flex justify-center col-span-2 md:col-span-1">
            <Button
              onClick={() => setAmountSort(SortHelper.getNextSort(amountSort))}
              className="bg-transparent px-0">
              <Flex gap={'1'} align={'center'}>
                <Text
                  size={'1'}
                  weight={'medium'}
                  className={SortHelper.getIcon(amountSort) === faChevronUp || SortHelper.getIcon(amountSort) === faChevronDown ? 'text-black' : 'text-black/40'}
                >
                  Amount
                </Text>
                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${SortHelper.getIcon(amountSort) === faChevronUp ? 'text-black' : 'text-black/40'}`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${SortHelper.getIcon(amountSort) === faChevronDown ? 'text-black' : 'text-black/40'}`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="hidden md:flex justify-center">
            <Button
              onClick={() => setDurationSort(SortHelper.getNextSort(durationSort))}
              className="bg-transparent px-0">
              <Flex gap={'1'}>
                <Text
                  size={'1'}
                  weight={'medium'}
                  color='gray'
                  className={SortHelper.getIcon(durationSort) === faChevronUp || SortHelper.getIcon(durationSort) === faChevronDown ? 'text-black' : 'text-black/40'}
                >
                  Duration
                </Text>
                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${SortHelper.getIcon(durationSort) === faChevronUp ? 'text-black' : 'text-black/40'}`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${SortHelper.getIcon(durationSort) === faChevronDown ? 'text-black' : 'text-black/40'}`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="hidden md:flex justify-center">
            <Button
              onClick={() => setLTVSort(SortHelper.getNextSort(ltvSort))}
              className="bg-transparent px-0">
              <Flex gap={'1'}>
                <Text
                  size={'1'}
                  weight={'medium'}
                  color='gray'
                  className={SortHelper.getIcon(ltvSort) === faChevronUp || SortHelper.getIcon(ltvSort) === faChevronDown ? 'text-black' : 'text-black/40'}
                >
                  LTV
                </Text>
                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${SortHelper.getIcon(ltvSort) === faChevronUp ? 'text-black' : 'text-black/40'}`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${SortHelper.getIcon(ltvSort) === faChevronDown ? 'text-black' : 'text-black/40'}`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="flex justify-center">
            <Button
              onClick={() => setInterestSort(SortHelper.getNextSort(interestSort))}
              className="bg-transparent px-0">
              <Flex gap={'1'}>
                <Text
                  size={'1'}
                  weight={'medium'}
                  color='gray'
                  className={SortHelper.getIcon(interestSort) === faChevronUp || SortHelper.getIcon(interestSort) === faChevronDown ? 'text-black' : 'text-black/40'}
                >
                  Interest
                </Text>
                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${SortHelper.getIcon(interestSort) === faChevronUp ? 'text-black' : 'text-black/40'}`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${SortHelper.getIcon(interestSort) === faChevronDown ? 'text-black' : 'text-black/40'}`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="mb-1 hidden md:flex justify-center">
            <Text
              size={'1'}
              weight={'medium'}
              className="text-black/50"
            >
              Coin
            </Text>
          </Box>
          <Box className="mb-1 hidden xl:block" />
        </Grid>

        <PiWarningOctagon className="opacity-40 text-black xl:hidden" />
      </Box>
      {loanOffers.sort((a, b) => {
        // Compare by amount first
        const amountComparison = SortHelper.sort(amountSort, a.loan_amount_max, b.loan_amount_min);
        if (amountComparison !== 0) return amountComparison;

        // Compare by duration if amount is the same
        const durationComparison = SortHelper.sort(durationSort, a.duration_months_min, b.duration_months_min);
        if (durationComparison !== 0) return durationComparison;

        // Compare by LTV if amount and duration are the same
        const ltvComparison = SortHelper.sort(ltvSort, a.min_ltv, b.min_ltv);
        if (ltvComparison !== 0) return ltvComparison;

        // Compare by interest if amount, duration, and LTV are the same
        return SortHelper.sort(interestSort, a.interest_rate, b.interest_rate);
      }).map((loanOffer, index) => (
        <div key={index} className={"overflow-y-scroll h-full"}>
          <LoanOfferComponent key={index} loanOffer={loanOffer} onRequest={onRequest} />
        </div>
      ))}

    </>
  );
}

export default LoanOffersComponent;
