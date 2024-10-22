import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { PostLoanRequest } from "@frontend-monorepo/http-client-borrower";
import { LoanAssetChain, LoanAssetType, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { LtvInfoLabel, StableCoin, StableCoinDropdown, StableCoinHelper } from "@frontend-monorepo/ui-shared";
import { formatCurrency } from "@frontend-monorepo/ui-shared";
import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Separator,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { IoIosUnlock } from "react-icons/io";

export default function CustomRequest() {
  const { postLoanRequest } = useBorrowerHttpClient();

  const { innerHeight } = window;

  const [loanAmount, setLoanAmount] = useState<number>(1000);

  const [stableCoin, setStableCoin] = useState<StableCoin>(StableCoin.USDC_SN);

  const minDuration = 1;
  const maxDuration = 18;
  const [duration, setDuration] = useState<number>(1);

  const minInterestRate = 10;
  const maxInterestRate = 100;
  const [interest, setInterest] = useState<number>(minInterestRate);

  const minLtv = 30;
  const maxLtv = 90;
  const [ltv, setLtv] = useState<number>(minLtv);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Since we only support creating loan requests for now, this flow is currently a dead end. To
  // emphasise that, we can disable the form after a loan request is created.
  const [isDone, setIsDone] = useState(false);

  const mapToPostLoanRequest = (): PostLoanRequest => {
    let assetType: LoanAssetType;
    let assetChain: LoanAssetChain;
    switch (stableCoin) {
      case StableCoin.USDT_SN:
        assetType = LoanAssetType.Usdt;
        assetChain = LoanAssetChain.Starknet;
        break;
      case StableCoin.USDC_SN:
        assetType = LoanAssetType.Usdc;
        assetChain = LoanAssetChain.Starknet;
        break;
      case StableCoin.USDT_POL:
        assetType = LoanAssetType.Usdt;
        assetChain = LoanAssetChain.Polygon;
        break;
      case StableCoin.USDC_POL:
        assetType = LoanAssetType.Usdc;
        assetChain = LoanAssetChain.Polygon;
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
      ltv: ltv / 100,
      interest_rate: interest / 100,
      loan_amount: loanAmount,
      duration_months: duration,
      loan_asset_type: assetType,
      loan_asset_chain: assetChain,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const data = mapToPostLoanRequest();

    try {
      setLoading(true);

      const res = await postLoanRequest(data);
      setLoading(false);
      if (res !== undefined) {
        setIsDone(true);
        setError("");
        setSuccess("Loan request successfully created");
      } else {
        console.error(res);
        setError("Failed creating request: undefined");
      }
    } catch (e) {
      setLoading(false);
      console.error(e);
      setError(`Failed creating request`);
    }
  };

  return (
    <Box
      className="flex-1 overflow-y-scroll"
      style={{
        height: innerHeight - 120,
      }}
    >
      <Grid className="md:grid-cols-2 bg-gradient-to-b from-white gap-10 via-white/80 to-white/0 p-6 md:p-8">
        <Box>
          <Box className="max-w-md w-full" mx={"auto"}>
            <Box mb={"8"}>
              <Heading as="h3" weight={"medium"} size={"8"} className="text-font-dark">
                Request a loan
              </Heading>
              <Text size={"2"} color="gray" weight={"medium"}>
                Choose your own terms.
              </Text>
            </Box>

            {/* Ticket Form */}
            <Form className="space-y-4" onSubmit={handleSubmit}>
              <Text as="p" weight={"medium"} size={"3"} className="text-font">Loan details</Text>

              {/* Loan Amount */}
              <Box className="space-y-1">
                <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>Amount to borrow</Text>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={1000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(parseFloat(e.target.value))}
                  disabled={isDone}
                  className="w-full rounded-lg text-sm text-font"
                >
                  <TextField.Slot>
                    <Text size={"3"} weight={"medium"}>$</Text>
                  </TextField.Slot>
                </TextField.Root>
              </Box>

              {/* Loan Duration */}
              <Box className="space-y-1">
                <Flex align={"center"} justify={"between"} pr={"2"}>
                  <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>Duration</Text>
                </Flex>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={minDuration}
                  max={maxDuration}
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                  disabled={isDone}
                  className="w-full rounded-lg text-sm text-font"
                >
                  <TextField.Slot className="pl-0" />
                  <TextField.Slot>
                    <Text size={"2"} color="gray" weight={"medium"}>
                      {duration > 1 ? "months" : "month"}
                    </Text>
                  </TextField.Slot>
                </TextField.Root>
              </Box>

              {/* Stable Coin */}
              <Box className="space-y-1">
                <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>Coin</Text>
                <StableCoinDropdown
                  coins={StableCoinHelper.all()}
                  defaultCoin={stableCoin}
                  onSelect={setStableCoin}
                  disabled={isDone}
                />
              </Box>

              {/* Interest Rate */}
              <Box className="space-y-1">
                <Flex align={"center"} justify={"between"} pr={"2"}>
                  <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>Interest rate</Text>
                </Flex>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={minInterestRate}
                  max={maxInterestRate}
                  value={interest}
                  onChange={(e) => setInterest(parseFloat(e.target.value))}
                  disabled={isDone}
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
                <Flex align={"center"} justify={"between"} pr={"2"}>
                  <LtvInfoLabel>
                    <Text className="text-font/70" as="label" size={"2"} weight={"medium"}>LTV</Text>
                    <FaInfoCircle color={"gray"} />
                  </LtvInfoLabel>
                </Flex>
                <TextField.Root
                  size={"3"}
                  variant="surface"
                  type="number"
                  color="gray"
                  min={minLtv}
                  max={maxLtv}
                  value={ltv}
                  onChange={(e) => setLtv(parseFloat(e.target.value))}
                  disabled={isDone}
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

              <Button
                color="purple"
                size={"3"}
                className="w-full font-medium"
                disabled={loading || isDone ? true : false}
                type="submit"
              >
                {loading ? <Spinner size={"3"} /> : "Open Ticket"}
              </Button>
            </Form>
          </Box>
          {success
            && (
              <Box className={"mt-4"}>
                <Callout.Root color="green">
                  <Callout.Icon>
                    <IoIosUnlock />
                  </Callout.Icon>
                  <Callout.Text>
                    {success}
                  </Callout.Text>
                </Callout.Root>
              </Box>
            )}
        </Box>

        <Box className="flex flex-col items-center justify-center">
          {/* Ticket */}
          <Box minWidth={"350px"} className="bg-purple-50/80 px-5 shadow-sm">
            <Box className="h-40 relative after:absolute before:absolute after:h-6 after:w-6
            after:rounded-full after:bg-[#fdfdfc] md:after:bg-white after:-bottom-3 after:-left-8 before:h-6 before:w-6
            before:rounded-full before:bg-[#fdfbfb] md:before:bg-white before:-bottom-3 before:-right-8 flex flex-col gap-2 items-center
            justify-center py-5 border-b border-font/30 border-dashed">
              <Heading size={"8"} className="text-center">
                {formatCurrency(loanAmount)}
              </Heading>
              {isDone ? <Badge size={"3"} color="green">Sent</Badge> : <Badge size={"3"} color="gray">Draft</Badge>}
            </Box>
            <Text as="p" weight={"medium"} size={"3"} className="text-font/80 my-5">Details</Text>
            <Box className="space-y-5 pb-8">
              <Separator size={"4"} className="bg-font/5" />
              <Flex justify={"between"} align={"center"}>
                <Text className="text-xs font-medium text-font/60">Duration</Text>
                <Text className="text-[13px] font-semibold text-black/70 capitalize">
                  {duration} {duration > 1 ? "months" : "month"}
                </Text>
              </Flex>
              <Separator size={"4"} className="bg-font/5" />
              <Flex justify={"between"} align={"center"}>
                <Text className="text-xs font-medium text-font/60">Coin</Text>
                <Text className="text-[13px] font-semibold text-black/70 capitalize">
                  {stableCoin != null ? StableCoinHelper.print(stableCoin) : ""}
                </Text>
              </Flex>
              <Separator size={"4"} className="bg-font/5" />
              <Flex justify={"between"} align={"center"}>
                <Text className="text-xs font-medium text-font/60">Interest</Text>
                <Text className="text-[13px] font-semibold text-black/70 capitalize">
                  {interest}%
                </Text>
              </Flex>
              <Separator size={"4"} className="bg-font/5" />
              <Flex justify={"between"} align={"center"}>
                <LtvInfoLabel>
                  <Text className="text-xs font-medium text-font/60">LTV ratio</Text>
                  <FaInfoCircle color={"gray"} />
                </LtvInfoLabel>
                <Text className="text-[13px] font-semibold text-black/70 capitalize">
                  {ltv}%
                </Text>
              </Flex>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}
