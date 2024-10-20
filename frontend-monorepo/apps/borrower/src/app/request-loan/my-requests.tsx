import { faInfoCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import {
  formatCurrency,
  StableCoin,
  StableCoinDropdown,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Flex, Grid, Heading, Separator, Text, TextField } from "@radix-ui/themes";
import React, { ChangeEvent, useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import Bitrefil from "./../../assets/bitrefil.png";
import Defi from "./../../assets/defi.jpg";
import Moon from "./../../assets/moon.jpg";
import EmptyResult from "../../assets/search.png";
import Sepa from "./../../assets/sepa.jpg";

export default function SimpleRequest() {
  const { innerHeight } = window;
  const navigate = useNavigate();
  const [advanceSearch, setAdvanceSearch] = React.useState<boolean>(false);
  const [adsSearchLoading, setAdsSearchLoading] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [availableOffers, setAvailableOffers] = useState<LoanOffer[]>([]);
  const [bestOffer, setBestOffer] = useState<LoanOffer | undefined>();
  // Loan Amount
  const [loanAmount, setLoanAmount] = React.useState<number | undefined>(undefined);
  // Stable Coin
  const [stableCoin, setStableCoin] = React.useState<StableCoin | undefined>(undefined);
  // Loan Duration
  const [loanDuration, setLoanDuration] = React.useState<number>(12);

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
  const [maxInterest, setMaxInterest] = React.useState<number | undefined>(undefined);
  // minimum LTV ratio
  const minLtvRate = 0.3;
  // LTV ratio
  const [ltv, setLtv] = React.useState<number | undefined>(undefined);

  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

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
          return wantedCoin == mapFromBackend;
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

  function onLtvChange(e: React.ChangeEvent<HTMLInputElement>) {
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

  function onMaxInterestChange(e: React.ChangeEvent<HTMLInputElement>) {
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

  // Return firstLoan as true or false depending on if the user has performed a loan before
  const [currentStep, setCurrentStep] = React.useState<number>(1);
  const [firstLoan, setFirstLoan] = React.useState<boolean>(true);
  const [loanRequested, setLoanRequested] = React.useState<boolean>(false);
  const [loanAddress, setLoanAddress] = useState("");

  return (
    <Box
      className="flex-1 overflow-y-scroll"
      style={{
        height: innerHeight - 130,
      }}
    >
      {firstLoan
        ? (
          <Box className="p-6 md:p-8 h-full flex flex-col md:items-center md:justify-center pt-12">
            <Heading size={"4"} className="font-semibold text-font-dark/90">
              Get your first loan with 4 easy steps.
            </Heading>

            <Box className="mt-6 md:mt-10 space-y-5 flex flex-col md:items-center">
              <Box className="flex flex-col md:flex-row md:grid md:grid-cols-2 xl:grid-cols-4 md:justify-center gap-4">
                {StepsToLoan.map((items, index) => (
                  <Box className="grid items-start grid-cols-[minmax(32px,_40px)_250px] md:flex gap-x-3 max-w-xs">
                    <Box className="h-full flex flex-col gap-2 items-center justify-start pt-0.5">
                      <Flex
                        align={"center"}
                        justify={"center"}
                        className={`h-8 w-8 border
                            ${
                          index === 0
                            ? "border-font-dark/80 text-font-dark/80 font-semibold"
                            : "border-font/10 text-font/30"
                        } 
                            rounded-full text-sm shrink-0`}
                      >
                        {index + 1}
                      </Flex>
                      <Box
                        className={index !== 3
                          ? "w-0 border-r-2 mx-auto border-dashed flex-grow md:hidden border-font/10"
                          : ""}
                      />
                    </Box>

                    <Box className={`space-y-1 rounded-lg max-w-[250px] mb-4`}>
                      <Heading
                        size={"3"}
                        className={index === 0
                          ? "text-font-dark/90 font-semibold"
                          : "text-font/70 font-semibold"}
                      >
                        {items.label}
                      </Heading>
                      <Text
                        as="p"
                        size={"2"}
                        className={index === 0
                          ? "text-font/80 font-medium"
                          : "text-font/60 font-medium"}
                      >
                        {items.description}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box className="space-y-4 max-w-sm w-full">
                <Button
                  variant="soft"
                  size={"3"}
                  color="purple"
                  className="w-full"
                  onClick={() => {
                    setFirstLoan(false);
                  }}
                >
                  Continue
                </Button>
              </Box>
            </Box>
          </Box>
        )
        : (
          currentStep === 1
            ? (
              <Box className="py-6 md:py-8">
                <Box className="px-6 md:px-8">
                  <Heading weight={"medium"} size={"5"}>
                    Select an option to proceed with
                  </Heading>
                </Box>
                <Separator size={"4"} className="bg-font/10 my-5" />
                <Box className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 px-6 md:px-8">
                  {/* PayWithMoon */}
                  <Box className="text-left w-full max-w-[350px]">
                    <Text as="p" size={"3"} weight={"bold"}>
                      A debit card by PayWithMoon
                    </Text>
                    <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
                      <img src={Moon} alt="PayWithMoon" />
                    </Box>

                    <Button
                      variant="soft"
                      size={"3"}
                      color="purple"
                      className="w-full"
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Continue
                    </Button>
                  </Box>
                  {/* Bitrefil */}
                  <Box className="text-left w-full max-w-[350px]">
                    <Text as="p" size={"3"} weight={"bold"}>
                      A debit card by Bitrefil
                    </Text>
                    <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
                      <img src={Bitrefil} alt="Bitrefil" />
                    </Box>

                    <Button
                      variant="soft"
                      size={"3"}
                      color="purple"
                      className="w-full"
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Continue
                    </Button>
                  </Box>
                  {/* Stable Coin */}
                  <Box className="text-left w-full max-w-[350px]">
                    <Text as="p" size={"3"} weight={"bold"}>
                      Receive stable coins
                    </Text>
                    <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
                      <img src={Defi} alt="DEFI" />
                    </Box>

                    <Button
                      variant="soft"
                      size={"3"}
                      color="purple"
                      className="w-full"
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Continue
                    </Button>
                  </Box>
                  {/* Bringin */}
                  <Box className="text-left w-full max-w-[350px]">
                    <Text as="p" size={"3"} weight={"bold"}>
                      To a bank account using SEPA via Bringin
                    </Text>
                    <Box className="h-52 w-full mb-4 mt-2 overflow-hidden rounded-2xl">
                      <img src={Sepa} alt="SEPA" />
                    </Box>

                    <Button
                      variant="soft"
                      size={"3"}
                      color="purple"
                      className="w-full"
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Continue
                    </Button>
                  </Box>
                </Box>
              </Box>
            )
            : (
              <Grid className="md:grid-cols-2 h-full">
                <Box className="p-6 md:p-8 ">
                  <Box>
                    <Heading as="h3" size={"6"} className="font-semibold text-font-dark">
                      Make a Request
                    </Heading>
                    {advanceSearch
                      ? (
                        <Text size={"2"} as="p" weight={"medium"} className="text-font/70">
                          Want to go back to{"  "}
                          <Text
                            size={"2"}
                            as="span"
                            onClick={() => {
                              setAdsSearchLoading(true);
                              setTimeout(() => {
                                setAdvanceSearch(!advanceSearch);
                                setAdsSearchLoading(false);
                              }, 200);
                            }}
                            className="text-font font-semibold hover:text-purple-700 cursor-pointer"
                          >
                            Simple search
                          </Text>{" "}
                          instead...
                        </Text>
                      )
                      : (
                        <Text size={"2"} as="p" weight={"medium"} className="text-font/70">
                          Want a more precise offer, perform{"  "}
                          <Text
                            size={"2"}
                            as="span"
                            onClick={() => {
                              setAdsSearchLoading(true);
                              setTimeout(() => {
                                setAdvanceSearch(!advanceSearch);
                                setAdsSearchLoading(false);
                              }, 1000);
                            }}
                            className="text-font font-semibold hover:text-purple-700 cursor-pointer"
                          >
                            Advance search
                          </Text>{" "}
                          instead...
                        </Text>
                      )}
                  </Box>
                  <Box mt={"7"}>
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
                            <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                              What's your preferred loan-to-value ratio?
                            </Text>
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

                      {loanRequested
                        ? (
                          <Flex direction={"column"} align={"start"} gap={"2"}>
                            <Text as="label" size={"2"} weight={"medium"}>Wallet Address</Text>
                            {loanAddress && (
                              <Callout.Root color="amber">
                                <Callout.Icon>
                                  <FontAwesomeIcon icon={faInfoCircle} />
                                </Callout.Icon>
                                <Callout.Text>
                                  Provide a valid address on the target network. Providing an incorrect address here
                                  will lead to loss of funds.
                                </Callout.Text>
                              </Callout.Root>
                            )}
                            <TextField.Root
                              className="w-full font-semibold border-0"
                              size={"3"}
                              variant="surface"
                              placeholder="Enter a valid address"
                              type="text"
                              color={"gray"}
                              value={loanAddress}
                              onChange={(e) => setLoanAddress(e.target.value)}
                            />
                          </Flex>
                        )
                        : (
                          <Box className="flex space-x-4 w-full">
                            <Button
                              color="purple"
                              size="3"
                              variant="soft"
                              className="flex-1 font-medium rounded-lg"
                              loading={isLoading}
                              type="button"
                              onClick={onShowOfferClick}
                            >
                              See offers
                            </Button>
                          </Box>
                        )}
                    </Form>
                  </Box>
                </Box>
                <Box className="flex flex-col items-center justify-center p-6 md:p-8">
                  <Box className="flex flex-col items-center h-full w-full border border-font/10 bg-white max-w-lg rounded-3xl pt-10">
                    {bestOffer
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
                              coin={StableCoinHelper.mapFromBackend(
                                bestOffer.loan_asset_chain,
                                bestOffer.loan_asset_type,
                              )!}
                              loanRequested={loanRequested}
                              onRequest={() => {
                                if (loanRequested) {
                                } else {
                                  setLoanRequested(true);
                                }
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
                            Nothing yet, make a request...
                          </Text>
                        </Box>
                      )}
                  </Box>
                </Box>
              </Grid>
            )
        )}
    </Box>
  );
}

interface SearchParams {
  lender: string;
  amount: number;
  duration: number;
  interest: number;
  ltv: number;
  loanRequested: boolean;
  coin: StableCoin;
  onRequest: () => void;
}

// Loan Display Component
const LoanSearched = (props: SearchParams) => {
  const { latestPrice } = usePrice();
  const collateralAmountBtc = props.amount / latestPrice;
  const collateralUsdAmount = props.amount / props.ltv;

  return (
    <>
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
            <Text className="text-xs font-medium text-font/60">
              Needed collateral ({(props.ltv * 100).toFixed(0)}% LTC)
            </Text>
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
            className={`text-white ${props.loanRequested ? "bg-purple-950" : "bg-btn"} w-full`}
            onClick={props.onRequest}
          >
            <Text
              size={"2"}
              className="font-semibold"
            >
              {props.loanRequested ? "Create Wallet" : "Request Loan"}
            </Text>
          </Button>
        </Box>
      </Box>
    </>
  );
};

const StepsToLoan = [
  {
    label: "Request a loan",
    description: "We submit your request to the right investor",
  },
  {
    label: "Accept loan terms",
    description: "Receive and accept the loan terms & conditions",
  },
  {
    label: "Lock your Bitcoin",
    description: "Follow our easy wizard to securely lock your Bitcoin",
  },
  {
    label: "Receive funds",
    description: "The investor transfers money to your bank account",
  },
];
