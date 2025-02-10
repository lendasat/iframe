import { useWallet } from "@frontend-monorepo/browser-wallet";
import {
  CreateLoanOfferRequest,
  LenderFeatureFlags,
  useAuth,
  useLenderHttpClient,
} from "@frontend-monorepo/http-client-lender";
import {
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  LtvInfoLabel,
  ONE_MONTH,
  parseLoanAsset,
} from "@frontend-monorepo/ui-shared";
import * as Checkbox from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Separator,
  Skeleton,
  Spinner,
  Tabs,
  Text,
  TextField,
} from "@radix-ui/themes";
import { FC, FormEvent, useCallback, useEffect } from "react";
import { useState } from "react";
import { Form } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { MdOutlineSwapCalls } from "react-icons/md";
import { PiInfo, PiWarningCircle } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import { KycLinkInputField } from "./components/KycLinkInputField";
import DurationSelector from "./LoanDurationSelector";

export interface LoanAmount {
  min: number;
  max: number;
}

interface DurationRange {
  min: number;
  max: number;
}

const CreateLoanOffer: FC = () => {
  const layout = window;
  const { doesWalletExist, getXpub } = useWallet();
  const { enabledFeatures } = useAuth();

  const navigate = useNavigate();
  const { postLoanOffer, getLoanAndContractStats } = useLenderHttpClient();

  const autoApproveEnabled = enabledFeatures.includes(
    LenderFeatureFlags.AutoApproveLoanRequests,
  );
  const kycOffersEnabled = enabledFeatures.includes(
    LenderFeatureFlags.KycOffers,
  );

  const [loanAmount, setLoanAmount] = useState<LoanAmount>({
    min: 1000,
    max: 100000,
  });
  const [loanReserve, setLoanReserve] = useState(loanAmount.max);
  const [autoAccept, setAutoAccept] = useState(autoApproveEnabled);
  const [ltv, setLtv] = useState<number>(50);
  const [interest, setInterest] = useState<number>(7.5);
  const [loanAsset, setLoanAsset] = useState<LoanAsset>(LoanAsset.USDT_ETH);
  const [loanRepaymentAddress, setLoanRepaymentAddress] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  const [loanDuration, setLoanDuration] = useState<DurationRange>({
    min: 7,
    max: ONE_MONTH * 6,
  });

  const [isKycRequired, setIsKycRequired] = useState(false);
  const [kycLink, setKycLink] = useState<string>("");

  const handleRangeChange = (start: number, end: number) => {
    setLoanDuration({ min: start, max: end });
  };

  useEffect(() => {
    if (doesWalletExist === false) {
      setError(
        "Cannot load wallet. Try to log back in. If the error persists, reach out to support",
      );
    } else {
      setError("");
    }
  }, [doesWalletExist]);

  const handleStableCoinChange = useCallback((coinString: string) => {
    const coin = parseLoanAsset(coinString);
    setLoanAsset(coin);
    setLoanRepaymentAddress("");
    setHideWalletConnectButton(false);
  }, []);

  const mapToCreateLoanOfferSchema = (
    lender_xpub: string,
  ): CreateLoanOfferRequest => {
    return {
      name: "Loan Offer",
      min_ltv: ltv / 100,
      interest_rate: interest / 100,
      loan_amount_min: loanAmount.min,
      loan_amount_max: loanAmount.max,
      loan_amount_reserve: loanReserve,
      duration_days_min: loanDuration.min,
      duration_days_max: loanDuration.max,
      loan_asset: loanAsset,
      loan_repayment_address: loanRepaymentAddress,
      auto_accept: autoAccept,
      lender_xpub: lender_xpub,
      kyc_link: kycLink || undefined,
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (loanReserve < loanAmount.max) {
      setError("Loan reserve cannot be smaller than max loan amount.");
      return;
    }

    setError("");

    try {
      const lender_xpub = await getXpub();
      const data = mapToCreateLoanOfferSchema(lender_xpub);

      setLoading(true);
      const res = await postLoanOffer(data);
      if (res !== undefined) {
        navigate(`/my-offers/${res.id}`);
      } else {
        console.error(res);
        setError(`Could not create loan offer`);
      }
    } catch (e) {
      console.error(e);
      setError(`Failed to create offer: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const {
    loading: statsLoading,
    value: stats,
    error: loadingStatsError,
  } = useAsync(async () => {
    return await getLoanAndContractStats();
  });

  if (loadingStatsError) {
    console.error(
      `Failed loading loan and contract stats ${loadingStatsError}`,
    );
  }

  const isRepaymentAddressRequired = LoanAssetHelper.isStableCoin(loanAsset);

  const disableCreateOfferButton =
    loanAmount.max === 0 ||
    loanDuration.max === 0 ||
    ltv === 0 ||
    loading ||
    !doesWalletExist ||
    (isKycRequired && kycLink.length === 0) ||
    (isRepaymentAddressRequired && loanRepaymentAddress.length === 0);

  return (
    <Form onSubmit={handleSubmit}>
      <Box
        style={{
          height: layout.innerHeight - 130,
          overflowY: "scroll",
        }}
      >
        <Box className="lg:grid lg:grid-cols-7 xl:grid-cols-6 w-full">
          <Box className="py-7 lg:pb-14 md:col-span-4 bg-gradient-to-br from-white/0 to-white border-r border-font/10 space-y-5 dark:from-dark/0 dark:to-dark dark:border-font-dark/10">
            <Box className="px-6 md:px-8">
              <Heading size={"7"} className="text-font dark:text-font-dark">
                Create Loan Offer
              </Heading>
              <Text size={"2"} className="text-font/60 dark:text-font-dark/60">
                Create a loan on your own terms.
              </Text>
            </Box>

            <Separator size={"4"} my={"5"} className="opacity-50" />

            <Box className="px-6 md:px-8">
              <Box
                width={"100%"}
                className="border border-font/10 dark:border-font-dark/10 rounded-xl py-10 px-6 md:px-8 space-y-6"
              >
                {/* Amount */}
                <Box className="space-y-1">
                  <Text
                    as="label"
                    size={"2"}
                    weight={"medium"}
                    className="text-font/60 dark:text-font-dark/60"
                  >
                    Amount to Lend
                  </Text>
                  <Flex align={"center"} gap={"15px"}>
                    <TextField.Root
                      size="3"
                      color="purple"
                      className="flex-1 text-sm rounded-lg text-font dark:text-font-dark"
                      type="number"
                      placeholder="Min Amount"
                      value={loanAmount.min}
                      onChange={(e) =>
                        setLoanAmount({
                          ...loanAmount,
                          min: Number(e.target.value),
                        })
                      }
                    />

                    <MdOutlineSwapCalls />

                    <TextField.Root
                      size="3"
                      type="number"
                      className="flex-1 text-sm rounded-lg text-font dark:text-font-dark"
                      color="purple"
                      placeholder="Max Amount"
                      value={loanAmount.max}
                      variant="surface"
                      onChange={(e) =>
                        setLoanAmount({
                          ...loanAmount,
                          max: Number(e.target.value),
                        })
                      }
                    />
                  </Flex>
                </Box>

                {/* Reserve */}
                <Box className="space-y-1">
                  <Flex
                    align={"center"}
                    gap={"2"}
                    className="text-font dark:text-font-dark"
                  >
                    <Text
                      as="label"
                      size={"2"}
                      weight={"medium"}
                      className="text-font/60 dark:text-font-dark/60"
                    >
                      Reserve (max amount across all requests for this offer)
                    </Text>
                  </Flex>

                  <TextField.Root
                    size="3"
                    className="flex-1 text-sm rounded-lg text-font dark:text-font-dark"
                    type="number"
                    placeholder="Loan Reserve"
                    color="purple"
                    value={loanReserve}
                    min={loanAmount.max}
                    step={1}
                    disabled={!autoApproveEnabled}
                    onChange={(e) => {
                      setLoanReserve(Number(e.target.value));
                      setAutoAccept(true);
                    }}
                  ></TextField.Root>
                </Box>

                {/* Auto Accept */}
                <Box className="space-y-1">
                  <Flex
                    align={"center"}
                    gap={"2"}
                    className="text-font dark:text-font-dark"
                  >
                    <Text
                      as="label"
                      size={"2"}
                      weight={"medium"}
                      className="text-font/60 dark:text-font-dark/60"
                    >
                      Auto Accept (Requests within Loan Reserve will be
                      automatically accepted)
                    </Text>
                  </Flex>

                  <div className="flex items-center">
                    <Checkbox.Root
                      className="flex size-[25px] appearance-none items-center justify-center rounded bg-white dark:bg-gray-300 shadow-[0_2px_10px] shadow-blackA4 outline-none hover:bg-violet3 focus:shadow-[0_0_0_2px_black]"
                      checked={autoAccept}
                      disabled={!autoApproveEnabled && !isKycRequired}
                      onCheckedChange={(checked) =>
                        setAutoAccept(checked === true)
                      }
                    >
                      <Checkbox.Indicator className="text-violet11">
                        <CheckIcon />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <label
                      className="pl-[15px] text-[15px] dark:text-font-dark/60"
                      htmlFor="c1"
                    >
                      Auto accept requests within Loan Reserve
                    </label>
                  </div>
                  {!autoApproveEnabled && (
                    <Callout.Root color="orange">
                      <Callout.Icon>
                        <PiInfo />
                      </Callout.Icon>

                      <Callout.Text>
                        {
                          "You do not qualify for the auto approval feature yet. Please reach out to us via discord if you want it."
                        }
                      </Callout.Text>
                    </Callout.Root>
                  )}
                </Box>

                {/* Duration */}
                <Box className="space-y-1">
                  <Flex align={"center"} gap={"1"}>
                    <Text
                      as="label"
                      size={"2"}
                      weight={"medium"}
                      className="text-font/60 dark:text-font-dark/60"
                    >
                      Duration
                    </Text>
                    <Text
                      as="span"
                      className="text-font/50 dark:text-font-dark/50"
                      weight={"medium"}
                      size={"1"}
                    >
                      (Days)
                    </Text>
                  </Flex>
                  <Flex align={"center"} gap={"15px"}>
                    <DurationSelector onRangeChange={handleRangeChange} />
                  </Flex>
                </Box>

                {/* LTV */}
                <Box className="space-y-1">
                  <LtvInfoLabel>
                    <Flex
                      align={"center"}
                      gap={"2"}
                      className="text-font dark:text-font-dark"
                    >
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/60 dark:text-font-dark/60"
                      >
                        Loan to value (LTV)
                      </Text>
                      <FaInfoCircle />
                    </Flex>
                  </LtvInfoLabel>
                  <TextField.Root
                    size="3"
                    className="flex-1 text-sm rounded-lg text-font dark:text-font-dark"
                    type="number"
                    placeholder="LTV (1-70%)"
                    color="purple"
                    value={ltv}
                    min={1}
                    max={70}
                    step={1}
                    onChange={(e) => setLtv(Number(e.target.value))}
                  >
                    <TextField.Slot className="pr-0" />
                    <TextField.Slot>
                      <Text size={"2"} weight={"medium"}>
                        1% - 70%
                      </Text>
                    </TextField.Slot>
                  </TextField.Root>
                </Box>

                {/* Interest Rate */}
                <Box className="space-y-1">
                  <Flex align={"center"} gap={"2"}>
                    <InterestRateInfoLabel>
                      <Text
                        as="label"
                        size={"2"}
                        weight={"medium"}
                        className="text-font/60 dark:text-font-dark/60"
                      >
                        Interest Rate
                      </Text>
                      <FaInfoCircle className="text-font dark:text-font-dark" />
                    </InterestRateInfoLabel>
                    <Skeleton loading={statsLoading}>
                      {stats && (
                        <Text
                          as="label"
                          size={"2"}
                          weight={"medium"}
                          className="text-font/50 dark:text-font-dark/50"
                        >
                          (current best offer:{" "}
                          {(stats?.loan_offer_stats.min * 100).toFixed(2)}%)
                        </Text>
                      )}
                    </Skeleton>
                  </Flex>

                  <TextField.Root
                    size="3"
                    className="flex-1 text-sm rounded-lg text-font dark:text-font-dark"
                    type="number"
                    placeholder="Interest Rate"
                    color="purple"
                    value={interest}
                    min={0}
                    max={100}
                    step={0.5}
                    onChange={(e) => setInterest(Number(e.target.value))}
                  >
                    <TextField.Slot className="pr-0" />
                    <TextField.Slot>
                      <Text size={"2"} weight={"medium"}>
                        0% - 100%
                      </Text>
                    </TextField.Slot>
                  </TextField.Root>
                </Box>

                {/* Stable Coin */}
                <Box className="space-y-1">
                  <Text
                    as="label"
                    size={"2"}
                    weight={"medium"}
                    className="text-font/60 dark:text-font-dark/60"
                  >
                    What asset will you lend?
                  </Text>
                  <Tabs.Root defaultValue="stablecoins">
                    <Tabs.List>
                      <Tabs.Trigger value="stablecoins">
                        Stablecoins
                      </Tabs.Trigger>
                      <Tabs.Trigger value="fiat">Fiat</Tabs.Trigger>
                    </Tabs.List>

                    <Box pt="3">
                      <Tabs.Content value="stablecoins">
                        <Flex direction={"column"} gap={"3"}>
                          <Grid
                            align={"center"}
                            columns={{ initial: "1", md: "3" }}
                            gap="3"
                            width="auto"
                          >
                            {LoanAssetHelper.allStableCoins().map((asset) => (
                              <Button
                                key={asset}
                                variant="outline"
                                type="button"
                                size={"2"}
                                className="h-10 rounded-lg"
                                color={loanAsset === asset ? "purple" : "gray"}
                                onClick={() => handleStableCoinChange(asset)}
                              >
                                {LoanAssetHelper.print(asset)}
                              </Button>
                            ))}
                          </Grid>
                          {/* Repayment Address */}
                          <Box className="space-y-1">
                            <Text
                              as="label"
                              size={"2"}
                              weight={"medium"}
                              className="text-font/60 dark:text-font-dark/60"
                            >
                              Loan Repayment Address
                            </Text>
                            <LoanAddressInputField
                              loanAddress={loanRepaymentAddress}
                              setLoanAddress={setLoanRepaymentAddress}
                              loanAsset={loanAsset}
                              hideButton={hideWalletConnectButton}
                              setHideButton={setHideWalletConnectButton}
                            />
                          </Box>
                        </Flex>
                      </Tabs.Content>

                      <Tabs.Content value="fiat">
                        <Flex direction={"column"} gap={"3"}>
                          <Grid
                            align={"center"}
                            columns={{ initial: "1", md: "3" }}
                            gap="3"
                            width="auto"
                          >
                            {LoanAssetHelper.allFiatCoins().map((asset) => (
                              <Button
                                key={asset}
                                variant="outline"
                                type="button"
                                size={"2"}
                                className="h-10 rounded-lg"
                                color={loanAsset === asset ? "purple" : "gray"}
                                onClick={() => handleStableCoinChange(asset)}
                              >
                                {LoanAssetHelper.print(asset)}
                              </Button>
                            ))}
                          </Grid>
                          <Callout.Root color="orange">
                            <Callout.Icon>
                              <PiInfo />
                            </Callout.Icon>

                            <Callout.Text>
                              {"You will need to provide your banking details when approving a request. " +
                                "These details will be e2e encrypted and only shared with the corresponding borrower."}
                            </Callout.Text>
                          </Callout.Root>
                        </Flex>
                      </Tabs.Content>
                    </Box>
                  </Tabs.Root>
                </Box>

                {kycOffersEnabled && (
                  <KycLinkInputField
                    link={kycLink}
                    setLink={setKycLink}
                    isKycRequired={isKycRequired}
                    setIsKycRequired={(isRequired) => {
                      if (isRequired) {
                        // If KYC is required, we can't do autoaccept
                        setAutoAccept(isRequired);
                      }
                      setIsKycRequired(isRequired);
                    }}
                  />
                )}

                <Box className="space-y-6 hidden lg:block">
                  {/* Error Message */}
                  {error && (
                    <Callout.Root color="red">
                      <Callout.Icon>
                        <PiWarningCircle />
                      </Callout.Icon>
                      <Callout.Text>{error}</Callout.Text>
                    </Callout.Root>
                  )}

                  {/* Submit */}
                  <Button
                    color="purple"
                    type="submit"
                    size={"3"}
                    variant="solid"
                    radius="large"
                    disabled={disableCreateOfferButton}
                    className="w-full h-12"
                  >
                    {loading ? <Spinner size={"3"} /> : "Create Offer"}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box className="flex flex-col justify-center px-6 lg:col-span-3 xl:col-span-2 py-12">
            <Text
              size={"2"}
              weight={"medium"}
              className="text-center text-font/50 dark:text-font-dark/50"
            >
              Offer Summary
            </Text>
            <Heading
              size={"7"}
              className={"text-center text-font dark:text-font-dark"}
            >
              Borrowers will see
            </Heading>
            <Box className="my-10">
              <Text
                size={"2"}
                weight={"medium"}
                className="text-font/70 dark:text-font-dark/70"
              >
                Loan Parameters
              </Text>
              <Separator
                size={"4"}
                mt={"4"}
                className="opacity-50 text-font dark:text-font-dark"
              />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text
                  as="label"
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Amount
                </Text>
                <Text
                  size={"2"}
                  className="text-font/80 dark:text-font-dark/80 font-semibold"
                >
                  {formatCurrency(loanAmount.min)} -{" "}
                  {formatCurrency(loanAmount.max)}
                </Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text
                  as="label"
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Duration
                </Text>
                <Text
                  size={"2"}
                  className="text-font/80 dark:text-font-dark/80 font-semibold"
                >
                  {getFormatedStringFromDays(loanDuration.min)} -{" "}
                  {getFormatedStringFromDays(loanDuration.max)}
                </Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <LtvInfoLabel>
                  <Flex
                    align={"center"}
                    gap={"2"}
                    className="text-font dark:text-font-dark"
                  >
                    <Text
                      as="label"
                      size={"2"}
                      className="text-font/50 dark:text-font-dark/50"
                    >
                      LTV
                    </Text>
                    <FaInfoCircle />
                  </Flex>
                </LtvInfoLabel>

                <Text
                  size={"2"}
                  className="text-font/80 dark:text-font-dark/80 font-semibold"
                >
                  {ltv.toFixed(2)}%
                </Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <InterestRateInfoLabel>
                  <Flex
                    align={"center"}
                    gap={"2"}
                    className="text-font dark:text-font-dark"
                  >
                    <Text
                      as="label"
                      size={"2"}
                      className="text-font/50 dark:text-font-dark/50"
                    >
                      Interest Rate
                    </Text>
                    <FaInfoCircle />
                  </Flex>
                </InterestRateInfoLabel>

                <Text
                  size={"2"}
                  className="text-font/80 dark:text-font-dark/80 font-semibold"
                >
                  {interest.toFixed(2)}%
                </Text>
              </Flex>
              <Separator size={"4"} color={"gray"} className="opacity-50" />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text
                  as="label"
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Loan Asset
                </Text>
                <Text
                  size={"2"}
                  className="text-font/80 dark:text-font-dark/80 font-semibold"
                >
                  {loanAsset ? LoanAssetHelper.print(loanAsset) : ""}
                </Text>
              </Flex>
              {kycOffersEnabled && (
                <>
                  <Separator size={"4"} color={"gray"} className="opacity-50" />
                  <Flex align={"center"} justify={"between"} my={"4"}>
                    <Text
                      as="label"
                      size={"2"}
                      className="text-font/50 dark:text-font-dark/50"
                    >
                      KYC Required
                    </Text>
                    <Text
                      size={"2"}
                      className="text-font/80 dark:text-font-dark/80 font-semibold"
                    >
                      {isKycRequired ? "Yes" : "No"}
                    </Text>
                  </Flex>
                </>
              )}
            </Box>

            <Box className="my-4">
              <Text
                size={"2"}
                weight={"medium"}
                className="text-font/70 dark:text-font-dark/70"
              >
                Repayment
              </Text>
              <Separator
                size={"4"}
                color={"gray"}
                mt={"4"}
                className="opacity-50"
              />
              <Flex align={"center"} justify={"between"} my={"4"}>
                <Text
                  as="label"
                  size={"2"}
                  className="text-font/50 dark:text-font-dark/50"
                >
                  Address
                </Text>
                <Text
                  size={"1"}
                  className="text-font/80 dark:text-font-dark/80 font-semibold capitalize"
                >
                  {loanRepaymentAddress
                    ? loanRepaymentAddress.slice(0, 14) + "..."
                    : ""}
                </Text>
              </Flex>
            </Box>
          </Box>
          <Box className="space-y-6 block w-full lg:hidden px-6 mb-20">
            {/* Error Message */}
            {error && (
              <Callout.Root color="red">
                <Callout.Icon>
                  <PiWarningCircle />
                </Callout.Icon>
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}

            {/* Submit */}
            <Button
              color="purple"
              type="submit"
              size={"3"}
              variant="solid"
              radius="large"
              disabled={disableCreateOfferButton}
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
