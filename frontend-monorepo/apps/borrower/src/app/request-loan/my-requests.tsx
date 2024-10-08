import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { StableCoin, StableCoinDropdown, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, Callout, Flex, Grid, Heading, Separator, Text, TextField } from "@radix-ui/themes";
import React from "react";
import { Form } from "react-bootstrap";
import { BsSearch } from "react-icons/bs";
import { IoInformationCircleOutline } from "react-icons/io5";
import { TfiTarget } from "react-icons/tfi";
import EmptyResult from "../../assets/search.png";

export default function RequestMade() {
  const { innerHeight } = window;
  const [advanceSearch, setAdvanceSearch] = React.useState<boolean>(false);
  const [adsSearchLoading, setAdsSearchLoading] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Loan Amount
  const [loanAmount, setLoanAmount] = React.useState<number>(1000);
  // Stable Coin
  const [stableCoin, setStableCoin] = React.useState<StableCoin>(StableCoin.USDC_ETH);
  // Loan Duration
  const [duration, setDuration] = React.useState<number>(1);
  // maximum repayment time
  const maxRepaymentTime = 18;
  // minimum interest rate
  const minInterestRate = 0.1;
  // Interest Rate
  const [interest, setInterest] = React.useState<number>(minInterestRate);
  // minimum LTV ratio
  const minLtvRate = 0.3;
  // LTV ratio
  const [ltv, setLtv] = React.useState<number>(minLtvRate);

  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const [result, setResult] = React.useState<boolean>(false);

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
                Open a Loan ticket
              </Heading>
              <Text size={"2"} color="gray" weight={"medium"}>
                Need a loan?... create a ticket that details the kind of loan you want...
              </Text>
            </Box>
            <Button
              size={"3"}
              color="purple"
              loading={adsSearchLoading}
              className="w-fit text-sm rounded-lg"
              onClick={() => {
                setAdsSearchLoading(true);
                setTimeout(() => {
                  setAdvanceSearch(!advanceSearch);
                  setAdsSearchLoading(false);
                }, 700);
              }}
            >
              {advanceSearch ? <BsSearch /> : <TfiTarget />}
              {!advanceSearch ? "Advanced Search" : "Quick Search"}
            </Button>
          </Box>

          <Box className="border border-font/5 p-5 md:p-7 rounded-2xl">
            {/* Ticket Form */}
            <Form className="space-y-4" // onSubmit={Onsubmit}
            >
              <Text as="p" weight={"medium"} size={"3"} className="text-font">Ticket Information</Text>

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
                  min={1000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(parseFloat(e.target.value))}
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
                  How long will the loan last?
                </Text>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={1}
                  max={maxRepaymentTime}
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
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
                          duration > 1 ? "opacity-100" : "opacity-0"
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
                      onSelect={setStableCoin}
                    />
                  </Box>

                  {/* Interest Rate */}
                  <Box className="space-y-1">
                    <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>
                      what's your preferred interest rate?
                    </Text>
                    <TextField.Root
                      size={"3"}
                      variant="surface"
                      type="number"
                      color="gray"
                      min={minInterestRate * 100}
                      max={100}
                      value={interest * 100}
                      onChange={(e) => setInterest(parseFloat(e.target.value) / 100)}
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
                      what's your preferred loan-to-value ratio?
                    </Text>
                    <TextField.Root
                      size={"3"}
                      variant="surface"
                      type="number"
                      color="gray"
                      min={minLtvRate * 100}
                      max={90}
                      value={ltv * 100}
                      onChange={(e) => setLtv(parseFloat(e.target.value) / 100)}
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

              <Button
                color="purple"
                size={"3"}
                className="w-full font-medium h-12 rounded-xl"
                loading={isLoading}
                // type="submit"

                // demo
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setTimeout(() => {
                    setResult(true);
                    setIsLoading(false);
                  }, 3000);
                }}
              >
                Open Ticket
              </Button>
            </Form>
          </Box>
        </Box>

        <Box className="flex flex-col items-center justify-center py-6 md:py-8 bg-white">
          {/* if search result is empty show the first box else show the result in the bottom bottom box */}

          <Box>
          </Box>
          <Box className="flex flex-col items-center h-full w-full">
            <Heading size={"4"} mb={"4"}>
              Loans the match your ticket will show here
            </Heading>

            {result
              ? (
                <>
                  <Box className="w-full py-1 px-6 border-t border-b bg-active-nav/15">
                    <Grid className="grid-cols-3 items-center text-font">
                      <Box className="col-span-2 md:col-span-1">
                        <Text size="2" weight={"medium"} className="text-font/90">Lender</Text>
                      </Box>
                      <Box className="md:flex justify-center hidden ">
                        <Text className="text-font/90" size={"2"} weight={"medium"}>
                          Amount
                        </Text>
                      </Box>
                      <Box />
                    </Grid>
                  </Box>

                  {/* Mapped Results */}
                  <Box className="w-full">
                    <LoanSearched
                      lender="satoshi nakamoto"
                      amount={{
                        min: 1000,
                        max: 10000,
                      }}
                      duration={{
                        min: 3,
                        max: 18,
                      }}
                      interest={40}
                      ltv={30}
                      coin={stableCoin}
                      onRequest={() => undefined}
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
  amount: {
    min: number;
    max: number;
  };
  duration: {
    min: number;
    max: number;
  };
  interest: number;
  ltv: number;
  coin: StableCoin;
  onRequest: () => void;
}

// Loan Display Component
const LoanSearched = (props: SearchParams) => {
  const [showDetails, setShowDetails] = React.useState<boolean>(false);
  return (
    <>
      <Box className="w-full py-2 px-6 border-b border-font/10">
        <Grid className="grid-cols-3 items-center text-font">
          <Box className="col-span-2 md:col-span-1">
            <Text size="3" className="tracking-wider text-font/90 capitalize">{props.lender}</Text>
          </Box>
          <Box className="md:flex justify-center hidden">
            <Text size={"2"} weight={"medium"}>
              {props.amount.min} - {props.amount.max}
            </Text>
          </Box>
          <Box className="flex justify-end">
            <Button
              size={"3"}
              variant="solid"
              className="bg-btn text-white"
              onClick={() => setShowDetails(!showDetails)}
            >
              <Text
                size={"2"}
                className="font-semibold"
              >
                {!showDetails ? "See more" : "See less"}
              </Text>
            </Button>
          </Box>
        </Grid>
      </Box>
      {showDetails && (
        <Box>
          <Box className="px-6 py-4 space-y-3">
            <Box className="mb-5">
              <Text size="3" className=" text-font/70 font-medium capitalize">more information</Text>
            </Box>
            <Flex justify={"between"} align={"center"}>
              <Text className="text-xs font-medium text-font/60">Lender</Text>
              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                satoshi nakamoto
              </Text>
            </Flex>
            <Separator size={"4"} />
            <Flex justify={"between"} align={"center"}>
              <Text className="text-xs font-medium text-font/60">Amount</Text>
              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                {props.amount.min} - {props.amount.max}
              </Text>
            </Flex>
            <Separator size={"4"} />
            <Flex justify={"between"} align={"center"}>
              <Text className="text-xs font-medium text-font/60">Duration</Text>
              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                {props.duration.min} - {props.duration.max} Months
              </Text>
            </Flex>
            <Separator size={"4"} />
            <Flex justify={"between"} align={"center"}>
              <Text className="text-xs font-medium text-font/60">Interest</Text>
              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                {props.interest}%
              </Text>
            </Flex>
            <Separator size={"4"} />
            <Flex justify={"between"} align={"center"}>
              <Text className="text-xs font-medium text-font/60">LTV</Text>
              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                {props.ltv}%
              </Text>
            </Flex>
            <Separator size={"4"} />
            <Flex justify={"between"} align={"center"}>
              <Text className="text-xs font-medium text-font/60">Coin</Text>
              <Text className="text-[13px] font-semibold text-black/70 capitalize">
                {props.coin}
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
      )}
    </>
  );
};
