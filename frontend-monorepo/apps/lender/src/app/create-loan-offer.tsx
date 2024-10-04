import {
  CreateLoanOfferRequest,
  LoanAssetChain,
  LoanAssetType,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import { useAuth } from "@frontend-monorepo/http-client-lender";
import { parseStableCoin, StableCoin } from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Flex, Grid, Heading, Separator, Spinner, Text, TextField } from "@radix-ui/themes";
import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { MdOutlineSwapCalls } from "react-icons/md";
import { PiWarningCircle } from "react-icons/pi";
import { useNavigate } from "react-router-dom";

export interface LoanDuration {
  min: number;
  max: number;
}

export interface LoanAmount {
  min: number;
  max: number;
}

const CreateLoanOffer: React.FC = () => {
  const layout = window;
  const { user } = useAuth();
  const [loanAmount, setLoanAmount] = useState<LoanAmount>({ min: 1000, max: 100000 });
  const [loanDuration, setLoanDuration] = useState<LoanDuration>({ min: 1, max: 12 });
  const [ltv, setLtv] = useState<number>(0.5);
  const [interest, setInterest] = useState<number>(0.12);
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | undefined>(StableCoin.USDT_ETH);
  const [loanRepaymentAddress, setLoanRepaymentAddress] = useState<string>(
    "0xA0C68B2C3cC21F9376eB514c9f1bF80A4939e4A6",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStableCoinChange = (coinString: string) => {
    const coin = parseStableCoin(coinString);
    setSelectedCoin(coin);
  };

  const mapToCreateLoanOfferSchema = (): CreateLoanOfferRequest => {
    let assetType = LoanAssetType.Usdt;
    let assetChain = LoanAssetChain.Starknet;
    switch (selectedCoin) {
      case StableCoin.USDT_SN:
        assetType = LoanAssetType.Usdt;
        assetChain = LoanAssetChain.Starknet;
        break;
      case StableCoin.USDC_SN:
        assetType = LoanAssetType.Usdc;
        assetChain = LoanAssetChain.Starknet;
        break;
      case StableCoin.USDT_ETH:
        assetType = LoanAssetType.Usdt;
        assetChain = LoanAssetChain.Ethereum;
        break;
      case StableCoin.USDC_ETH:
        assetType = LoanAssetType.Usdc;
        assetChain = LoanAssetChain.Ethereum;
        break;
    }

    return {
      name: "Loan Offer",
      min_ltv: ltv,
      interest_rate: interest,
      loan_amount_min: loanAmount.min,
      loan_amount_max: loanAmount.max,
      duration_months_min: loanDuration.min,
      duration_months_max: loanDuration.max,
      loan_asset_type: assetType,
      loan_asset_chain: assetChain,
      loan_repayment_address: loanRepaymentAddress,
    };
  };
  const navigate = useNavigate();
  const { postLoanOffer } = useLenderHttpClient();
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const data = mapToCreateLoanOfferSchema();

    try {
      setLoading(true);
      setTimeout(async () => {
        setLoading(false);
        const res = await postLoanOffer(data);
        console.log(res);
        if (res !== undefined) {
          navigate(`/my-offers/${res.id}`);
        } else {
          console.error(res);
        }
      }, 2000);
    } catch (e) {
      setTimeout(() => {
        setLoading(false);
        console.error(e);
        setError(`Failed creating offer ${JSON.stringify(e)}`);
      }, 2000);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Box
        style={{
          height: layout.innerHeight - 65,
          overflowY: "scroll",
        }}
      >
        <Box className="lg:grid lg:grid-cols-7 xl:grid-cols-6 w-full">
          <Box className="py-7 lg:pb-14 md:col-span-4 bg-gradient-to-br from-white/0 to-white border-r border-font/10 space-y-5">
            <Box className="px-6 md:px-8">
              <Heading size={"7"} className="text-font">
                Create an Offer
              </Heading>
              <Text size={"2"} className="text-font/60">Create a loan on your own terms.</Text>
            </Box>

            <Separator size={"4"} my={"5"} className="opacity-50" />

            <Box className="px-6 md:px-8">
              <Box width={"100%"} className="border border-font/10 rounded-xl py-10 px-6 md:px-8 space-y-6">
                {/* Amount */}
                <Box className="space-y-1">
                  <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                    Amount to Lend
                  </Text>
                  <Flex align={"center"} gap={"15px"}>
                    <TextField.Root
                      size="3"
                      color="purple"
                      className="flex-1 text-sm rounded-lg"
                      type="number"
                      placeholder="Min Amount"
                      value={loanAmount.min}
                      onChange={(e) => setLoanAmount({ ...loanAmount, min: Number(e.target.value) })}
                    />

                    <MdOutlineSwapCalls />

                    <TextField.Root
                      size="3"
                      type="number"
                      className="flex-1 text-sm rounded-lg"
                      color="purple"
                      placeholder="Max Amount"
                      value={loanAmount.max}
                      variant="surface"
                      onChange={(e) => setLoanAmount({ ...loanAmount, max: Number(e.target.value) })}
                    />
                  </Flex>
                </Box>

                {/* Duration */}
                <Box className="space-y-1">
                  <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                    Duration
                  </Text>
                  <Text as="span" className="text-font/50" weight={"medium"} size={"1"}>(Months)</Text>
                  <Flex align={"center"} gap={"15px"}>
                    <TextField.Root
                      size="3"
                      className="flex-1 text-sm rounded-lg"
                      type="number"
                      color="purple"
                      placeholder="Min Duration"
                      value={loanDuration.min}
                      onChange={(e) => setLoanDuration({ ...loanDuration, min: Number(e.target.value) })}
                    />

                    <MdOutlineSwapCalls />

                    <TextField.Root
                      size="3"
                      type="number"
                      className="flex-1 text-sm rounded-lg"
                      placeholder="Max Duration"
                      value={loanDuration.max}
                      onChange={(e) => setLoanDuration({ ...loanDuration, max: Number(e.target.value) })}
                    />
                  </Flex>
                </Box>

                {/* LTV */}
                <Box className="space-y-1">
                  <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                    Loan to value
                  </Text>
                  <TextField.Root
                    size="3"
                    className="flex-1 text-sm rounded-lg"
                    type="number"
                    placeholder="LTV (0-1)"
                    color="purple"
                    value={ltv}
                    min={0}
                    max={0.9}
                    step={0.1}
                    onChange={(e) => setLtv(Number(e.target.value))}
                  >
                    <TextField.Slot className="pr-0" />
                    <TextField.Slot>
                      <Text size={"2"} weight={"medium"}>0.1 - 0.9</Text>
                    </TextField.Slot>
                  </TextField.Root>
                </Box>

                {/* Interest Rate */}
                <Box className="space-y-1">
                  <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                    Interest Rate
                  </Text>
                  <TextField.Root
                    size="3"
                    className="flex-1 text-sm rounded-lg"
                    type="number"
                    placeholder="Interest Rate"
                    color="purple"
                    value={interest}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(e) => setInterest(Number(e.target.value))}
                  >
                    <TextField.Slot className="pr-0" />
                    <TextField.Slot>
                      <Text size={"2"} weight={"medium"}>0.0 - 1.0</Text>
                    </TextField.Slot>
                  </TextField.Root>
                </Box>

                {/* Stable Coin */}
                <Box className="space-y-1">
                  <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                    Stable Coins
                  </Text>
                  <Flex align={"center"} gap={"3"} wrap={"wrap"}>
                    {Object.keys(StableCoin).map((coin) => (
                      <Button
                        key={coin}
                        variant="outline"
                        type="button"
                        size={"2"}
                        className="h-10 rounded-lg"
                        color={selectedCoin === coin ? "purple" : "gray"}
                        onClick={() => handleStableCoinChange(coin)}
                      >
                        {coin === "USDT_SN"
                          ? "USDT Straknet"
                          : coin === "USDC_SN"
                          ? "USDC Starknet"
                          : coin === "USDT_ETH"
                          ? "USDT Ethereum"
                          : coin === "USDC_ETH"
                          ? "USDC Ethereum"
                          : ""}
                      </Button>
                    ))}
                  </Flex>
                </Box>

                {/* Repayment Address */}
                <Box className="space-y-1">
                  <Text as="label" size={"2"} weight={"medium"} className="text-font/60">
                    Loan Repayment Address
                  </Text>
                  <TextField.Root
                    size="3"
                    className="flex-1 text-sm"
                    color="purple"
                    placeholder="Enter Repayment Address"
                    value={loanRepaymentAddress}
                    onChange={(e) => setLoanRepaymentAddress(e.target.value)}
                  />
                </Box>

                <Box className="space-y-6 hidden lg:block">
                  {/* Errror Message */}
                  {error && (
                    <Callout.Root color="red">
                      <Callout.Icon>
                        <PiWarningCircle />
                      </Callout.Icon>
                      <Callout.Text>
                        {error}
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {/* Submit */}
                  <Button
                    color="purple"
                    type="submit"
                    size={"3"}
                    variant="solid"
                    radius="large"
                    disabled={loanAmount.max && loanDuration.max
                        && ltv && loanRepaymentAddress
                        && !loading
                      ? false
                      : true}
                    className="w-full h-12"
                  >
                    {loading ? <Spinner size={"3"} /> : "Create Offer"}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box className="flex flex-col justify-center px-6 lg:col-span-3 xl:col-span-2 py-12">
            <Text size={"2"} weight={"medium"} className="text-center text-font/50">
              Lending Summary
            </Text>
            <Heading size={"7"} className={"text-center text-font-dark"}>Borrowers will see</Heading>
            <Box className="my-10">
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Loan Information
              </Text>
              <Separator size={"4"} color={"gray"} mt={"4"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">Amount</Text>
                <Text size={"2"} className="text-font-dark/80 font-semibold">
                  ${loanAmount.min} ~ ${loanAmount.max}
                </Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">Duration</Text>
                <Text size={"2"} className="text-font-dark/80 font-semibold">
                  {loanDuration.min} ~ {loanDuration.max} Months
                </Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">LTV</Text>
                <Text size={"2"} className="text-font-dark/80 font-semibold">{(ltv * 100).toFixed(2)}%</Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">Interest Rate</Text>
                <Text size={"2"} className="text-font-dark/80 font-semibold">{(interest * 100).toFixed(2)}$</Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">Preferred Coin</Text>
                <Text size={"2"} className="text-font-dark/80 font-semibold">
                  {selectedCoin === "USDT_SN"
                    ? "USDT Straknet"
                    : selectedCoin === "USDC_SN"
                    ? "USDC Starknet"
                    : selectedCoin === "USDT_ETH"
                    ? "USDT Ethereum"
                    : selectedCoin === "USDC_ETH"
                    ? "USDC Ethereum"
                    : ""}
                </Text>
              </Flex>
            </Box>

            <Box className="my-4">
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Lenders Information
              </Text>
              <Separator size={"4"} color={"gray"} mt={"4"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">Lender</Text>
                <Text size={"2"} className="text-font-dark/80 font-semibold capitalize">{user?.name}</Text>
              </Flex>
            </Box>

            <Box className="my-4">
              <Text size={"2"} weight={"medium"} className="text-font/70">
                Refunding Information
              </Text>
              <Separator size={"4"} color={"gray"} mt={"4"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text as="label" size={"2"} className="text-font/50">Wallet Address</Text>
                <Text size={"1"} className="text-font-dark/80 font-semibold capitalize">
                  {loanRepaymentAddress ? loanRepaymentAddress.slice(0, 14) + "..." : ""}
                </Text>
              </Flex>
            </Box>
          </Box>
          <Box className="space-y-6 block w-full lg:hidden px-6 mb-20">
            {/* Errror Message */}
            {error && (
              <Callout.Root color="red">
                <Callout.Icon>
                  <PiWarningCircle />
                </Callout.Icon>
                <Callout.Text>
                  {error}
                </Callout.Text>
              </Callout.Root>
            )}

            {/* Submit */}
            <Button
              color="purple"
              type="submit"
              size={"3"}
              variant="solid"
              radius="large"
              disabled={loanAmount.max && loanDuration.max
                  && ltv && loanRepaymentAddress
                  && !loading
                ? false
                : true}
              className="w-full h-12"
            >
              {loading ? <Spinner size={"3"} /> : "Create Offer"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Form>
  );
};

export default CreateLoanOffer;
