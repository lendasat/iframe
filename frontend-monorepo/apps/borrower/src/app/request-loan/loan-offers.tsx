import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { faChevronDown, faChevronUp, faMinus } from "@fortawesome/free-solid-svg-icons";
import type { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { AprInfoLabel, LtvInfoLabel } from "@frontend-monorepo/ui-shared";
import { Box, Button, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { IoCaretDownOutline, IoCaretUp } from "react-icons/io5";
import { PiWarningOctagon } from "react-icons/pi";
import { LoanOfferComponent } from "./loan-offer";

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
  isLoading: boolean;
}

function LoanOffersComponent({ loanOffers, onRequest, isLoading }: LoanOffersComponentProps) {
  const [amountSort, setAmountSort] = useState<Sort>(Sort.NONE);
  const [durationSort, setDurationSort] = useState<Sort>(Sort.NONE);
  const [ltvSort, setLTVSort] = useState<Sort>(Sort.NONE);
  const [interestSort, setInterestSort] = useState<Sort>(Sort.NONE);
  const layout = window;

  return (
    <>
      <Box className="bg-active-nav/15 py-1 px-6 md:px-8 flex items-center">
        <Grid className="grid-cols-4 md:grid-cols-6 xl:grid-cols-7 items-center grow">
          <Box className="mb-1 col-span-1 xl:col-span-2">
            <Text
              size={"1"}
              weight={"medium"}
              className="text-font/50 dark:text-font-dark/50"
            >
              Lender
            </Text>
          </Box>
          <Box className="flex justify-center col-span-2 md:col-span-1">
            <Button
              onClick={() => setAmountSort(SortHelper.getNextSort(amountSort))}
              className="bg-transparent px-0"
            >
              <Flex gap={"1"} align={"center"}>
                <Text
                  size={"1"}
                  weight={"medium"}
                  className={SortHelper.getIcon(amountSort) === faChevronUp
                      || SortHelper.getIcon(amountSort) === faChevronDown
                    ? "text-font dark:text-font-dark"
                    : "text-font/40 dark:text-font-dark/40"}
                >
                  Amount
                </Text>
                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${
                      SortHelper.getIcon(amountSort) === faChevronUp
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${
                      SortHelper.getIcon(amountSort) === faChevronDown
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="hidden md:flex justify-center">
            <Button
              onClick={() => setDurationSort(SortHelper.getNextSort(durationSort))}
              className="bg-transparent px-0"
            >
              <Flex gap={"1"}>
                <Text
                  size={"1"}
                  weight={"medium"}
                  color="gray"
                  className={SortHelper.getIcon(durationSort) === faChevronUp
                      || SortHelper.getIcon(durationSort) === faChevronDown
                    ? "text-font dark:text-font-dark"
                    : "text-font/40 dark:text-font-dark/40"}
                >
                  Duration
                </Text>
                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${
                      SortHelper.getIcon(durationSort) === faChevronUp
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${
                      SortHelper.getIcon(durationSort) === faChevronDown
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="hidden md:flex justify-center">
            <Button
              onClick={() => setLTVSort(SortHelper.getNextSort(ltvSort))}
              className="bg-transparent px-0"
            >
              <Flex gap={"1"}>
                <LtvInfoLabel>
                  <Text
                    size={"1"}
                    weight={"medium"}
                    className={SortHelper.getIcon(ltvSort) === faChevronUp
                        || SortHelper.getIcon(ltvSort) === faChevronDown
                      ? "text-font dark:text-font-dark"
                      : "text-font/40 dark:text-font-dark/40"}
                  >
                    LTV
                  </Text>
                  <FaInfoCircle className={"text-font dark:text-font-dark"} />
                </LtvInfoLabel>

                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${
                      SortHelper.getIcon(ltvSort) === faChevronUp
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${
                      SortHelper.getIcon(ltvSort) === faChevronDown
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="flex justify-center">
            <Button
              onClick={() => setInterestSort(SortHelper.getNextSort(interestSort))}
              className="bg-transparent px-0"
            >
              <Flex gap={"1"}>
                <AprInfoLabel>
                  <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                    <Text
                      size={"1"}
                      weight={"medium"}
                      color="gray"
                      className={SortHelper.getIcon(interestSort) === faChevronUp
                          || SortHelper.getIcon(interestSort) === faChevronDown
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"}
                    >
                      Interest Rate/APR
                    </Text>
                    <FaInfoCircle className={"text-font dark:text-font-dark"} />
                  </Flex>
                </AprInfoLabel>

                <Box>
                  <IoCaretUp
                    className={`text-[10px] -mb-1
                    ${
                      SortHelper.getIcon(interestSort) === faChevronUp
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                  <IoCaretDownOutline
                    className={`text-[10px] -mt-1
                      ${
                      SortHelper.getIcon(interestSort) === faChevronDown
                        ? "text-font dark:text-font-dark"
                        : "text-font/40 dark:text-font-dark/40"
                    }`}
                  />
                </Box>
              </Flex>
            </Button>
          </Box>
          <Box className="mb-1 hidden md:flex justify-center">
            <Text
              size={"1"}
              weight={"medium"}
              className="text-font/50 dark:text-font-dark/50"
            >
              Coin
            </Text>
          </Box>
          <Box className="mb-1 hidden xl:block" />
        </Grid>

        <PiWarningOctagon className="opacity-40 text-font dark:text-font-dark xl:hidden" />
      </Box>
      <Box
        style={{
          paddingBottom: 50,
          overflowY: "scroll",
          height: layout.innerHeight - 280,
        }}
      >
        {isLoading && <Loading />}
        {!isLoading
          && loanOffers.sort((a, b) => {
            // Compare by amount first
            const amountComparison = SortHelper.sort(amountSort, a.loan_amount_min, b.loan_amount_min);
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
            <div key={index}>
              <LoanOfferComponent key={index} loanOffer={loanOffer} onRequest={onRequest} />
            </div>
          ))}
      </Box>
    </>
  );
}

const Loading = () => {
  return (
    <div className="flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <Spinner className="animate-spin mx-auto mb-4 text-blue-500 dark:text-blue-300" size={48} />
        <p className="text-font text-lg dark:text-font-dark">
          Loading...
        </p>
      </div>
    </div>
  );
};

export default LoanOffersComponent;
