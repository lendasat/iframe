import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { StableCoin } from "@frontend-monorepo/ui-shared";
import {
  formatCurrency,
  LtvInfoLabel,
  StableCoinDropdown,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Flex, Grid, Heading, Separator, Text, TextField } from "@radix-ui/themes";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { BsSearch } from "react-icons/bs";
import { FaInfoCircle } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { TfiTarget } from "react-icons/tfi";
import { useNavigate } from "react-router-dom";
import EmptyResult from "../../assets/search.png";

export default function SimpleRequest() {
  const { innerHeight } = window;
  const navigate = useNavigate();
  const [advanceSearch, setAdvanceSearch] = useState<boolean>(false);
  const [adsSearchLoading, setAdsSearchLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableOffers, setAvailableOffers] = useState<LoanOffer[]>([]);
  const [bestOffer, setBestOffer] = useState<LoanOffer | undefined>();
  // Loan Amount
  const [loanAmount, setLoanAmount] = useState<number | undefined>(undefined);
  // Stable Coin
  const [stableCoin, setStableCoin] = useState<StableCoin | undefined>(undefined);
  // Loan Duration
  const [loanDuration, setLoanDuration] = useState<number>(12);

  const { getLoanOffers } = useBorrowerHttpClient();

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const res = await getLoanOffers() || [];
        setAvailableOffers(res);
      } catch (e) {
        console.error(`error here ${e}`);
        setError(`${e}`);
      }
    };
    fetchLoans();
  });
  // maximum repayment time
  const maxRepaymentTime = 18;
  // minimum maxInterest rate
  const minInterestRate = 0.1;
  // Interest Rate
  const [maxInterest, setMaxInterest] = useState<number | undefined>(undefined);
  // minimum LTV ratio
  const minLtvRate = 0.3;
  // LTV ratio
  const [ltv, setLtv] = useState<number | undefined>(undefined);

  const [error, setError] = useState("");
  const [success] = useState("");

  interface OfferFilter {
    loanAmount?: number;
    duration: number | undefined;
    minLtv: number | undefined;
    maxInterest: number | undefined;
    wantedCoin: StableCoin | undefined;
  }

  const onShowOfferClick = () => {
    refreshBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      minLtv: ltv,
      maxInterest: maxInterest,
    });
  };

  function refreshBestOffer(
    { loanAmount, duration, wantedCoin, minLtv, maxInterest }: OfferFilter,
  ) {
    setIsLoading(true);
    const sortedAndFiltered = availableOffers
      .filter((offer) => {
        if (!loanAmount) {
          return false;
        }
        return offer.loan_amount_max >= loanAmount && offer.loan_amount_min <= loanAmount;
      })
      .filter((offer) => {
        if (!duration) {
          return true;
        }
        return offer.duration_months_max >= duration && offer.duration_months_min <= duration;
      }).filter((offer) => {
        if (advanceSearch && wantedCoin) {
          const mapFromBackend = StableCoinHelper.mapFromBackend(offer.loan_asset_chain, offer.loan_asset_type);
          return wantedCoin === mapFromBackend;
        } else {
          return true;
        }
      }).filter((offer) => {
        if (advanceSearch && maxInterest) {
          return offer.interest_rate <= maxInterest;
        } else {
          return true;
        }
      }).filter((offer) => {
        if (advanceSearch && minLtv) {
          return offer.min_ltv >= minLtv;
        } else {
          return true;
        }
      }).sort((a, b) => {
        return a.interest_rate - b.interest_rate;
      });
    setBestOffer(sortedAndFiltered[0]);
    setIsLoading(false);
  }

  function onLoanAmountChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedLoanAmount = parseFloat(e.target.value);
    if (isNaN(parsedLoanAmount)) {
      parsedLoanAmount = 1;
    }
    setLoanAmount(parsedLoanAmount);
    refreshBestOffer({
      loanAmount: parsedLoanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      minLtv: ltv,
      maxInterest: maxInterest,
    });
  }

  function onLoanDurationChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedDuration = parseFloat(e.target.value);
    if (isNaN(parsedDuration)) {
      parsedDuration = 1;
    }
    setLoanDuration(parsedDuration);
    refreshBestOffer({
      loanAmount: loanAmount,
      duration: parsedDuration,
      wantedCoin: stableCoin,
      minLtv: ltv,
      maxInterest: maxInterest,
    });
  }

  function onStableCoinSelect(selectedStableCoin: StableCoin | undefined) {
    console.log(`selectedStableCoin  is set to : ${selectedStableCoin}`);
    setStableCoin(selectedStableCoin);
    refreshBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: selectedStableCoin,
      minLtv: ltv,
      maxInterest: maxInterest,
    });
  }

  function onLtvChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedLtv = parseFloat(e.target.value);
    if (isNaN(parsedLtv)) {
      parsedLtv = 1;
    }
    setLtv(parsedLtv / 100);
    refreshBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      minLtv: parsedLtv,
      maxInterest: maxInterest,
    });
  }

  function onMaxInterestChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedInterestRate = parseFloat(e.target.value);
    if (isNaN(parsedInterestRate)) {
      parsedInterestRate = 1;
    }
    setMaxInterest(parsedInterestRate / 100);
    refreshBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      minLtv: ltv,
      maxInterest: parsedInterestRate,
    });
  }

  const coin = bestOffer
    ? StableCoinHelper.mapFromBackend(bestOffer.loan_asset_chain, bestOffer.loan_asset_type)
    : null;

  return (
    <Box
      className="flex-1 overflow-y-scroll"
      style={{
        height: innerHeight - 130,
      }}
    >
      <Grid className="md:grid-cols-2 h-full">
        <Box className="bg-gradient-to-br from-white via-white/40 to-white/0 p-6 md:p-8 md:border-r md:border-font/10">
          <Box className="w-full h-fit flex flex-col gap-8 mb-14">
            <Box>
              <Heading as="h3" size={"8"} weight={"medium"} className="text-font-dark">
                Request a loan
              </Heading>
            </Box>
          </Box>

          <Box className="border border-font/5 p-5 md:p-7 rounded-2xl">
            {/* Ticket Form */}
            <Form className="space-y-4" onSubmit={onShowOfferClick}>
              {/* Loan Amount */}
              <Box className="space-y-1">
                <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                  How much do you wish to borrow?
                </Text>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={1}
                  value={loanAmount}
                  onChange={onLoanAmountChange}
                  className="w-full rounded-lg text-sm text-font"
                >
                  <TextField.Slot>
                    <Text size={"3"} weight={"medium"}>$</Text>
                  </TextField.Slot>
                </TextField.Root>
              </Box>

              {/* Loan Duration */}
              <Box className="space-y-1">
                <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                  For how long do you want to borrow?
                </Text>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={1}
                  max={maxRepaymentTime}
                  value={loanDuration}
                  onChange={onLoanDurationChange}
                  className="w-full rounded-lg text-sm text-font"
                >
                  <TextField.Slot className="pl-0" />
                  <TextField.Slot>
                    <Flex>
                      <Text size={"2"} color="gray" weight={"medium"}>Month</Text>
                      <Text
                        size={"2"}
                        color="gray"
                        weight={"medium"}
                        className={`transition-opacity ease-in-out ${
                          loanDuration > 1 ? "opacity-100" : "opacity-0"
                        } duration-300`}
                      >
                        s
                      </Text>
                    </Flex>
                  </TextField.Slot>
                </TextField.Root>
              </Box>

              {advanceSearch && (
                <>
                  {/* Stable Coin */}
                  <Box className="space-y-1">
                    <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                      What stable coin do you need?
                    </Text>
                    <StableCoinDropdown
                      coins={StableCoinHelper.all()}
                      defaultCoin={stableCoin}
                      onSelect={onStableCoinSelect}
                    />
                  </Box>

                  {/* Interest Rate */}
                  <Box className="space-y-1">
                    <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                      What's your preferred interest rate?
                    </Text>
                    <TextField.Root
                      size={"3"}
                      variant="surface"
                      type="number"
                      color="gray"
                      min={minInterestRate * 100}
                      max={100}
                      value={maxInterest ? (maxInterest * 100).toFixed(0) : ""}
                      onChange={onMaxInterestChange}
                      className="w-full rounded-lg text-sm text-font"
                    >
                      <TextField.Slot className="pl-0" />
                      <TextField.Slot>
                        <Text size={"2"} color="gray" weight={"medium"}>
                          %
                        </Text>
                      </TextField.Slot>
                    </TextField.Root>
                  </Box>

                  {/* LTV Rate */}
                  <Box className="space-y-1">
                    <LtvInfoLabel>
                      <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                        What's your preferred LTV ratio?
                      </Text>
                      <FaInfoCircle color={"gray"} />
                    </LtvInfoLabel>

                    <TextField.Root
                      size={"3"}
                      variant="surface"
                      type="number"
                      color="gray"
                      min={minLtvRate * 100}
                      max={90}
                      value={ltv ? (ltv * 100).toFixed(2) : ""}
                      onChange={onLtvChange}
                      className="w-full rounded-lg text-sm text-font"
                    >
                      <TextField.Slot className="pl-0" />
                      <TextField.Slot>
                        <Text size={"2"} color="gray" weight={"medium"}>
                          %
                        </Text>
                      </TextField.Slot>
                    </TextField.Root>
                  </Box>
                </>
              )}

              {error
                && (
                  <Callout.Root color="red" className="w-full">
                    <Callout.Icon>
                      <FontAwesomeIcon icon={faWarning} />
                    </Callout.Icon>
                    <Callout.Text>
                      {error}
                    </Callout.Text>
                  </Callout.Root>
                )}

              {success && (
                <Callout.Root color="green">
                  <Callout.Icon>
                    <IoInformationCircleOutline />
                  </Callout.Icon>
                  <Callout.Text>
                    {success}
                  </Callout.Text>
                </Callout.Root>
              )}

              <div className="flex space-x-4 w-full">
                <Button
                  color="purple"
                  size="3"
                  className="flex-1 font-medium h-12 rounded-xl"
                  loading={isLoading}
                  type="button"
                  onClick={onShowOfferClick}
                >
                  See offers
                </Button>
                <Button
                  size="3"
                  color="gray"
                  loading={adsSearchLoading}
                  className="flex-1 h-12 text-sm rounded-xl flex items-center justify-center"
                  onClick={() => {
                    setAdsSearchLoading(true);
                    setTimeout(() => {
                      setAdvanceSearch(!advanceSearch);
                      setAdsSearchLoading(false);
                    }, 10);
                  }}
                >
                  {advanceSearch ? <BsSearch className="mr-2" /> : <TfiTarget className="mr-2" />}
                  {!advanceSearch ? "Advanced Search" : "Simple Search"}
                </Button>
              </div>
            </Form>
          </Box>
        </Box>

        <Box className="flex flex-col items-center justify-center py-6 md:py-8 bg-white">
          <Box>
          </Box>
          <Box className="flex flex-col items-center h-full w-full">
            {bestOffer && coin
              ? (
                <>
                  <Heading size="4" mb="4" className="font-normal">
                    Best match to borrow <strong>{formatCurrency(loanAmount || 0)}</strong> for{" "}
                    <strong>{loanDuration}</strong> months
                  </Heading>
                  <Box className="w-full">
                    <LoanSearched
                      lender={bestOffer.lender.name}
                      amount={loanAmount || 0}
                      duration={loanDuration || 0}
                      interest={bestOffer.interest_rate}
                      ltv={bestOffer.min_ltv}
                      coin={coin}
                      onRequest={() => {
                        navigate(`/request-loan/${bestOffer.id}`, {
                          state: {
                            loanOffer: bestOffer,
                            loanFilter: { amount: loanAmount, stableCoin: stableCoin, ltv: ltv, period: loanDuration },
                          },
                        });
                      }}
                    />
                  </Box>
                </>
              )
              : (
                <Box minHeight={"500px"} className="flex flex-col items-center justify-center">
                  <img
                    src={EmptyResult}
                    alt="No Result"
                    className="max-w-xs"
                  />
                  <Text className="text-font/90" size={"2"} weight={"medium"}>
                    Nothing to show yet
                  </Text>
                </Box>
              )}
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}

interface SearchParams {
  lender: string;
  amount: number;
  duration: number;
  interest: number;
  ltv: number;
  coin: StableCoin;
  onRequest: () => void;
}

// Loan Display Component
const LoanSearched = (props: SearchParams) => {
  const { latestPrice } = usePrice();

  const collateralAmountBtc = props.amount / latestPrice;
  const collateralUsdAmount = props.amount / props.ltv;

  return (
    <Box>
      <Box className="px-6 py-4 space-y-3">
        <Flex justify={"between"} align={"center"}>
          <Text className="text-xs font-medium text-font/60">Lender</Text>
          <Text className="text-[13px] font-semibold text-black/70 capitalize">
            {props.lender}
          </Text>
        </Flex>
        <Separator size={"4"} />
        <Flex justify={"between"} align={"center"}>
          <Text className="text-xs font-medium text-font/60">Interest</Text>
          <Text className="text-[13px] font-semibold text-black/70">
            {(props.interest * 100).toFixed(1)}% Per Year
          </Text>
        </Flex>
        <Separator size={"4"} />
        <Flex justify={"between"} align={"center"}>
          <Flex justify={"between"} align={"start"} gap={"2"}>
            <Text className="text-xs font-medium text-font/60">
              Needed collateral
            </Text>
            <LtvInfoLabel>
              <Text className="text-font/50" size={"1"} weight={"medium"}>
                ({(props.ltv * 100).toFixed(0)}% LTV)
              </Text>
              <FaInfoCircle color={"gray"} />
            </LtvInfoLabel>
          </Flex>

          <div className="flex flex-col">
            <Text className="text-[13px] font-semibold text-black/70 capitalize">
              {collateralAmountBtc.toFixed(8)} BTC
            </Text>
            <Text className="text-[11px] text-black/50 mt-0.5 self-end">
              ≈ {formatCurrency(collateralUsdAmount)}
            </Text>
          </div>
        </Flex>
        <Separator size={"4"} />
        <Flex justify={"between"} align={"center"}>
          <Text className="text-xs font-medium text-font/60">Coin</Text>
          <Text className="text-[13px] font-semibold text-black/70 capitalize">
            {StableCoinHelper.print(props.coin)}
          </Text>
        </Flex>
        <Separator size={"4"} />
        <Button
          size={"3"}
          variant="solid"
          className="bg-btn text-white w-full"
          onClick={props.onRequest}
        >
          <Text
            size={"2"}
            className="font-semibold"
          >
            Request Loan
          </Text>
        </Button>
      </Box>

      <Separator size={"4"} />
    </Box>
  );
};
