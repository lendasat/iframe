import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { CreateWalletModal, UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import { Integration, useAuth, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { LoanOffer, UserCardDetail } from "@frontend-monorepo/http-client-borrower";
import {
  AbbreviationExplanationInfo,
  formatCurrency,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LoanAddressInputField,
  LtvInfoLabel,
  newFormatCurrency,
  StableCoin,
  StableCoinDropdown,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Flex, Grid, Heading, Separator, Spinner, Text, TextField } from "@radix-ui/themes";
import axios from "axios";
import { Network, validate } from "bitcoin-address-validation";
import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Form } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { FaInfo } from "react-icons/fa6";
import { useLocation, useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import EmptyResult from "../../../assets/search.png";
import { MoonCardDropdown } from "./MoonCardDropdown";

interface OfferFilter {
  loanAmount?: number;
  duration: number | undefined;
  minLtv: number | undefined;
  maxInterest: number | undefined;
  wantedCoin: StableCoin | undefined;
  validCoins: StableCoin[];
  availableOffers: LoanOffer[];
  advanceSearch: boolean;
}

const findBestOffer = ({
  loanAmount,
  duration,
  wantedCoin,
  validCoins,
  minLtv,
  maxInterest,
  availableOffers,
  advanceSearch,
}: OfferFilter) => {
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
      const offerCoin = StableCoinHelper.mapFromBackend(offer.loan_asset_chain, offer.loan_asset_type);
      return validCoins.includes(offerCoin);
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
  return sortedAndFiltered[0];
};

type LocationState = {
  option: LoanProductOption;
};

function findSmallestLoanOffer(loanOffers: LoanOffer[]): LoanOffer | undefined {
  if (loanOffers.length === 0) return undefined;

  return loanOffers.reduce((smallest, current) =>
    (current.loan_amount_min < smallest.loan_amount_min) ? current : smallest
  );
}

async function isInUS(): Promise<boolean> {
  try {
    const response = await axios.get("https://get.geojs.io/v1/ip/country.json");
    const data = response.data;

    return data.country === "US";
  } catch (error) {
    console.error("Error fetching geo-location data:", error);
    return true; // Default to true in case of an error
  }
}

export const Step2PickOffer = () => {
  const { getNextPublicKey } = useWallet();
  const { getLoanOffers, postContractRequest } = useBorrowerHttpClient();
  const navigate = useNavigate();

  const location = useLocation();
  let selectedOption: LoanProductOption | undefined;
  if (location.state) {
    const { option } = location.state as LocationState;
    selectedOption = option;
  } else {
    navigate("/requests");
  }

  let validCoins: StableCoin[];
  let integration = Integration.StableCoin;
  let coinSelectHidden = false;

  const { getUserCards } = useBorrowerHttpClient();
  const { value: moonCards, error: userCardsError } = useAsync(async () => {
    // Users located in the US cannot top up cards.
    if (await isInUS()) {
      return [];
    } else {
      return getUserCards();
    }
  });

  if (userCardsError) {
    console.error(`Failed fetching credit cards: ${userCardsError}`);
  }

  switch (selectedOption) {
    case LoanProductOption.StableCoins:
      validCoins = StableCoinHelper.all();
      integration = Integration.StableCoin;
      break;
    case LoanProductOption.PayWithMoonDebitCard:
      validCoins = [StableCoin.USDC_POL];
      integration = Integration.PayWithMoon;
      coinSelectHidden = true;
      break;
    case LoanProductOption.BitrefillDebitCard:
    case LoanProductOption.BringinBankAccount:
      validCoins = [];
  }

  // We do not need the borrower to provide a loan address if they want to create a Pay with Moon
  // card with their loan.
  const needLoanAddress = integration !== Integration.PayWithMoon;

  const needMoonCard = integration === Integration.PayWithMoon;

  const [advanceSearch, setAdvanceSearch] = useState<boolean>(false);
  const [bestOffer, setBestOffer] = useState<LoanOffer | undefined>();
  // Loan Amount
  const [loanAmount, setLoanAmount] = useState<number>(1);
  const [loanAmountStringInput, setLoanAmountStringInput] = useState("1");

  const validCoin = validCoins[0];

  // Stable Coin
  const [stableCoin, setStableCoin] = useState<StableCoin | undefined>(validCoin);

  // Loan Duration
  const [loanDuration, setLoanDuration] = useState<number>(1);
  const [loanDurationString, setLoanDurationString] = useState("1");
  // maximum repayment time
  const maxRepaymentTime = 18;
  // minimum maxInterest rate
  const minInterestRate = 0.01;
  // Interest Rate
  const [maxInterest, setMaxInterest] = useState<number | undefined>(undefined);
  // minimum LTV ratio
  const minLtvRate = 0.3;
  // LTV ratio
  const [ltv, setLtv] = useState<number | undefined>(undefined);
  const [loanAddress, setLoanAddress] = useState<string | undefined>(undefined);
  const [btcAddress, setBtcAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [offerPicked, setOfferPicked] = useState<boolean>(false);
  const [moonCardId, setMoonCardId] = useState<string | undefined>(undefined);

  const { loading, value: maybeAvailableOffers, error: loadingError } = useAsync(async () => {
    return getLoanOffers();
  }, []);

  if (loadingError) {
    console.error(`Failed loading loan offers ${loadingError}`);
  }

  const availableOffers = maybeAvailableOffers || [];

  const onShowOfferClick = useCallback(() => {
    const availOffers = maybeAvailableOffers || [];
    const loanOffer = findBestOffer({
      loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      validCoins,
      minLtv: ltv,
      maxInterest,
      availableOffers: availOffers,
      advanceSearch,
    });
    setBestOffer(loanOffer);
  }, [
    loanAmount,
    loanDuration,
    stableCoin,
    validCoins,
    ltv,
    maxInterest,
    maybeAvailableOffers,
    advanceSearch,
    setBestOffer,
  ]);

  function onLoanAmountChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    setLoanAmountStringInput(e.target.value);
    let parsedLoanAmount = parseFloat(e.target.value);
    if (isNaN(parsedLoanAmount)) {
      parsedLoanAmount = 1;
    }
    setLoanAmount(parsedLoanAmount);
    const refreshedBestOffer = findBestOffer({
      loanAmount: parsedLoanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      validCoins: validCoins,
      minLtv: ltv,
      maxInterest: maxInterest,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(refreshedBestOffer);
  }

  function onLoanDurationChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    setLoanDurationString(e.target.value);
    let parsedDuration = parseFloat(e.target.value);
    if (isNaN(parsedDuration)) {
      parsedDuration = 1;
    }
    setLoanDuration(parsedDuration);
    const refreshedBestOffer = findBestOffer({
      loanAmount: loanAmount,
      duration: parsedDuration,
      wantedCoin: stableCoin,
      validCoins: validCoins,
      minLtv: ltv,
      maxInterest: maxInterest,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(refreshedBestOffer);
  }

  function onStableCoinSelect(selectedStableCoin: StableCoin | undefined) {
    setStableCoin(selectedStableCoin);
    const refreshedBestOffer = findBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: selectedStableCoin,
      validCoins: validCoins,
      minLtv: ltv,
      maxInterest: maxInterest,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(refreshedBestOffer);
  }

  function onLtvChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedLtv = parseFloat(e.target.value);
    if (isNaN(parsedLtv)) {
      parsedLtv = 1;
    }

    const parsedLtvUnified = parsedLtv / 100;
    setLtv(parsedLtvUnified);
    const refreshedBestOffer = findBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      validCoins: validCoins,
      minLtv: parsedLtvUnified,
      maxInterest: maxInterest,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(refreshedBestOffer);
  }

  function onMaxInterestChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedInterestRate = parseFloat(e.target.value);
    if (isNaN(parsedInterestRate)) {
      parsedInterestRate = 1;
    }
    const parsedInterestRateUnified = parsedInterestRate / 100;
    setMaxInterest(parsedInterestRateUnified);
    const refreshedBestOffer = findBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      validCoins: validCoins,
      minLtv: ltv,
      maxInterest: parsedInterestRateUnified,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(refreshedBestOffer);
  }

  const requestLoan = async () => {
    try {
      if (bestOffer === undefined) {
        setError("No offer selected");
        return;
      }
      setIsLoading(true);
      const borrowerPk = getNextPublicKey();

      const res = await postContractRequest({
        loan_id: bestOffer.id,
        loan_amount: loanAmount || 0,
        duration_months: loanDuration,
        borrower_btc_address: btcAddress,
        borrower_pk: borrowerPk,
        borrower_loan_address: loanAddress,
        integration: integration,
        moon_card_id: moonCardId,
      });

      if (res !== undefined) {
        navigate("/my-contracts");
      } else {
        setError("Failed at posting request.");
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const offerWithSmallestAmount = findSmallestLoanOffer(availableOffers);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!offerWithSmallestAmount) {
      return;
    }

    setLoanAmountStringInput(offerWithSmallestAmount.loan_amount_min.toString());
    setLoanAmount(offerWithSmallestAmount.loan_amount_min);
    setLoanDurationString(offerWithSmallestAmount.duration_months_min.toString());
    setLoanDuration(offerWithSmallestAmount.duration_months_min);
  }, [loading, maybeAvailableOffers, offerWithSmallestAmount]);

  useEffect(() => {
    // This will run after the state updates
    if (loanAmount && loanDuration) {
      onShowOfferClick();
    }
  }, [loanAmount, loanDuration, onShowOfferClick]);

  if (loading) {
    // TODO: might be nicer to use a skeleton
    return <Spinner />;
  }

  return (
    <Grid className="md:grid-cols-2 h-full">
      <Box className="p-6 md:p-8 ">
        <Box>
          <Heading as="h3" size={"6"} className="font-semibold text-font dark:text-font-dark">
            Find a loan offer
          </Heading>
        </Box>
        <Box mt={"7"}>
          <Form className="space-y-4" onSubmit={onShowOfferClick}>
            {/* Loan Amount */}
            <Box className="space-y-1">
              <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
                How much do you wish to borrow?
              </Text>
              <TextField.Root
                size={"3"}
                variant="surface"
                type="number"
                color="gray"
                min={1}
                value={loanAmountStringInput}
                onChange={onLoanAmountChange}
                className="w-full rounded-lg text-sm text-font dark:text-font-dark"
              >
                <TextField.Slot>
                  <Text size={"3"} weight={"medium"}>$</Text>
                </TextField.Slot>
              </TextField.Root>
            </Box>

            {/* Loan Duration */}
            <Box className="space-y-1">
              <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
                For how long do you want to borrow?
              </Text>
              <TextField.Root
                size={"3"}
                variant="surface"
                type="number"
                color="gray"
                min={1}
                max={maxRepaymentTime}
                value={loanDurationString}
                onChange={onLoanDurationChange}
                className="w-full rounded-lg text-sm text-font dark:text-font-dark"
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
                {/* Stable Coin */ !coinSelectHidden
                  && (
                    <Box className="space-y-1">
                      <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
                        What stable coin do you need?
                      </Text>
                      <StableCoinDropdown
                        coins={validCoins}
                        defaultCoin={stableCoin}
                        onSelect={onStableCoinSelect}
                        disabled={coinSelectHidden}
                      />
                    </Box>
                  )}

                {/* Interest Rate */}
                <Box className="space-y-1">
                  <InterestRateInfoLabel>
                    <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                      <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
                        What's your preferred interest rate?
                      </Text>
                      <FaInfoCircle />
                    </Flex>
                  </InterestRateInfoLabel>

                  <TextField.Root
                    size={"3"}
                    variant="surface"
                    type="number"
                    color="gray"
                    min={minInterestRate * 100}
                    max={100}
                    value={maxInterest ? (maxInterest * 100).toFixed(0) : ""}
                    onChange={onMaxInterestChange}
                    className="w-full rounded-lg text-sm text-font dark:text-font-dark"
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
                  <Text className="text-font/70 dark:text-font-dark/70" as="label" size={"2"} weight={"medium"}>
                    <LtvInfoLabel>
                      <Text as="label" className="text-sm font-medium text-font dark:text-font-dark">
                        What's your preferred loan-to-value ratio?
                      </Text>
                      <FaInfoCircle color={"gray"} />
                    </LtvInfoLabel>
                  </Text>
                  <TextField.Root
                    size={"3"}
                    variant="surface"
                    type="number"
                    color="gray"
                    min={minLtvRate * 100}
                    max={90}
                    value={ltv ? `${(ltv * 100).toFixed(0)}` : ""}
                    onChange={onLtvChange}
                    className="w-full rounded-lg text-sm text-font dark:text-font-dark"
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

            {loadingError
              && (
                <Callout.Root color="red" className="w-full">
                  <Callout.Icon>
                    <FontAwesomeIcon icon={faWarning} />
                  </Callout.Icon>
                  <Callout.Text>
                    {loadingError.message}
                  </Callout.Text>
                </Callout.Root>
              )}

            <Box className="flex space-x-4">
              <Button
                color="blue"
                size="3"
                variant="soft"
                className="flex-1 font-medium rounded-lg"
                loading={isLoading}
                type="button"
                onClick={() => setAdvanceSearch(!advanceSearch)}
              >
                {!advanceSearch ? "Advanced options" : "Back to simple search"}
              </Button>
              <Button
                color="purple"
                size="3"
                variant="soft"
                className="flex-1 font-medium rounded-lg"
                loading={isLoading}
                type="button"
                onClick={onShowOfferClick}
              >
                Show best offer
              </Button>
            </Box>
          </Form>
        </Box>
      </Box>
      <Box className="flex flex-col items-center justify-center p-6 md:p-8">
        <Box className="flex flex-col items-center h-full w-full border border-font/10 bg-white max-w-lg rounded-3xl pt-10 dark:border-dark dark:bg-dark-700 dark:text-white">
          {bestOffer
            ? (
              <>
                <Heading size="4" mb="4" className="text-font dark:text-font-dark">
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
                    )}
                    loanAddress={loanAddress}
                    needLoanAddress={needLoanAddress}
                    setLoanAddress={setLoanAddress}
                    btcAddress={btcAddress}
                    setBtcAddress={setBtcAddress}
                    offerPicked={offerPicked}
                    setOfferPicked={() => setOfferPicked(true)}
                    needMoonCard={needMoonCard}
                    moonCards={moonCards ?? []}
                    setMoonCardId={setMoonCardId}
                    error={error}
                    setError={setError}
                    onOfferConfirmed={async () => {
                      await requestLoan();
                    }}
                    onOfferSelected={() => {
                      setOfferPicked(true);
                    }}
                    isLoading={isLoading}
                    coinSelectHidden={coinSelectHidden}
                    // TODO: once we have multiple origination fees
                    originationFee={bestOffer.origination_fee[0].fee}
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
                <Text className="text-font/90 dark:text-font-dark/90" size={"2"} weight={"medium"}>
                  No offers found for these inputs...
                </Text>
                {offerWithSmallestAmount
                  && (
                    <Box className={"px-4 py-4"}>
                      <Callout.Root color={"teal"}>
                        <Callout.Icon>
                          <FaInfo size={"18"} />
                        </Callout.Icon>
                        <Callout.Text>
                          Best available offer starts from {formatCurrency(offerWithSmallestAmount.loan_amount_min)}
                          {"  "}with a minimum duration of {offerWithSmallestAmount.duration_months_min} months.
                          <br />
                        </Callout.Text>
                      </Callout.Root>
                    </Box>
                  )}
              </Box>
            )}
        </Box>
      </Box>
    </Grid>
  );
};

interface SearchParams {
  lender: string;
  amount: number;
  duration: number;
  interest: number;
  ltv: number;
  offerPicked: boolean;
  setOfferPicked: () => void;
  coin: StableCoin;
  onOfferSelected: () => void;
  onOfferConfirmed: () => void;
  loanAddress?: string;
  needLoanAddress: boolean;
  setLoanAddress: (val: string) => void;
  btcAddress: string;
  setBtcAddress: (val: string) => void;
  needMoonCard: boolean;
  moonCards: UserCardDetail[];
  setMoonCardId: (val?: string) => void;
  setError: (val: string) => void;
  error: string;
  isLoading: boolean;
  coinSelectHidden: boolean;
  originationFee: number;
}

// Loan Display Component
const LoanSearched = (props: SearchParams) => {
  const { doesWalletExist, isWalletLoaded } = useWallet();
  const { user } = useAuth();

  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");
  const [walletSecretConfirmed, setWalletSecretConfirmed] = useState(isWalletLoaded);
  const { latestPrice } = usePrice();

  const collateralAmountBtc = props.amount / latestPrice / props.ltv;
  const collateralUsdAmount = props.amount / props.ltv;
  // loan_amount / (collateral_sats / dec!(100_000_000) * LTV_THRESHOLD_LIQUIDATION)
  const liquidationPrice = props.amount / collateralAmountBtc * 0.95;

  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);
  const handleCloseCreateWalletModal = () => setShowCreateWalletModal(false);
  const handleOpenCreateWalletModal = () => setShowCreateWalletModal(true);

  const handleSubmitCreateWalletModal = async () => {
    setWalletSecretConfirmed(true);
    handleCloseCreateWalletModal();
  };
  const handleSubmitUnlockWalletModal = async () => {
    setWalletSecretConfirmed(true);
    handleCloseUnlockWalletModal();
  };

  const handleUnlockOrCreateWallet = async () => {
    try {
      if (!doesWalletExist) {
        handleOpenCreateWalletModal();
        return;
      }
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      props.setError(`Failed setting contract secret ${error}`);
    }
  };

  const onBitcoinAddressChange = (address: string) => {
    let network = Network.mainnet;
    if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
      network = Network.testnet;
    } else if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
      network = Network.regtest;
    }

    const valid = validate(address, network);
    if (!valid) {
      setBitcoinAddressInputError("Invalid address");
    } else {
      setBitcoinAddressInputError("");
    }
    props.setBtcAddress(address);
  };

  const actualInterest = props.interest / (12 / props.duration);
  const actualInterestUsdAmount = props.amount * actualInterest;

  const confirmOfferButtonEnabled = walletSecretConfirmed && bitcoinAddressInputError === "";

  const discountedFee = user?.first_time_discount_rate || 0.0;
  const isDiscountedFeeApplied = discountedFee ? discountedFee > 0 : false;

  const originationFee = props.originationFee - (props.originationFee * discountedFee);
  const originationFeeBtc = collateralAmountBtc * originationFee;
  const originationFeeUsd = props.amount * originationFee;

  return (
    <>
      <CreateWalletModal
        show={showCreateWalletModal}
        handleClose={handleCloseCreateWalletModal}
        handleSubmit={handleSubmitCreateWalletModal}
      />
      <UnlockWalletModal
        show={showUnlockWalletModal}
        handleClose={handleCloseUnlockWalletModal}
        handleSubmit={handleSubmitUnlockWalletModal}
      />
      <Box>
        <Box className="px-6 py-4 space-y-3">
          <Flex justify={"between"} align={"center"}>
            <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">Lender</Text>
            <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
              {props.lender}
            </Text>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <InterestRateInfoLabel>
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Interest
                </Text>
                <FaInfoCircle />
              </Flex>
            </InterestRateInfoLabel>

            <div className="flex flex-col">
              {props.duration !== 12
                && (
                  <Flex gap={"2"}>
                    <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70">
                      {(actualInterest * 100).toFixed(2)}%
                    </Text>
                    <Text className="text-[11px] text-font/70 dark:text-font-dark/50 mt-0.5 self-end">
                      ({(props.interest * 100).toFixed(1)}% p.a.)
                    </Text>
                  </Flex>
                )}
              {props.duration === 12
                && (
                  <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70">
                    {(actualInterest * 100).toFixed(2)}% p.a.
                  </Text>
                )}

              <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <LtvInfoLabel>
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Needed collateral ({(props.ltv * 100).toFixed(0)}% LTV)
                </Text>
                <FaInfoCircle />
              </Flex>
            </LtvInfoLabel>
            <div className="flex flex-col">
              <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                {collateralAmountBtc.toFixed(8)} BTC
              </Text>
              <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                ≈ {formatCurrency(collateralUsdAmount)}
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <div className="flex flex-col">
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Origination fee
                </Text>
                <FaInfoCircle />
              </Flex>

              {isDiscountedFeeApplied
                && (
                  <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-start">
                    {-(discountedFee * 100).toFixed(2)}% discount applied
                  </Text>
                )}
            </div>
            <div className="flex flex-col">
              <Text
                className={`text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                {originationFeeBtc.toFixed(8)} BTC
              </Text>
              <Text
                className={`text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                ≈ {formatCurrency(originationFeeUsd)}
              </Text>
            </div>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <LiquidationPriceInfoLabel>
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Liquidation Price
                </Text>
                <FaInfoCircle />
              </Flex>
            </LiquidationPriceInfoLabel>
            <div className="flex flex-col">
              <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                {newFormatCurrency({ value: liquidationPrice, maxFraction: 0, minFraction: 1 })}
              </Text>
            </div>
          </Flex>
          {!props.coinSelectHidden && (
            <>
              <Separator size={"4"} />
              <Flex justify={"between"} align={"center"}>
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">Coin</Text>
                <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                  {StableCoinHelper.print(props.coin)}
                </Text>
              </Flex>
            </>
          )}
          <Separator size={"4"} />
          {props.offerPicked && (
            <>
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <div className="flex items-center gap-2">
                  <AbbreviationExplanationInfo
                    header={"Collateral Refund Address"}
                    subHeader={""}
                    description={"The Bitcoin address where you want your collateral returned upon loan repayment."}
                  >
                    <Flex gap={"2"} align={"center"}>
                      <Text
                        size={"2"}
                        weight={"medium"}
                        className={"text-xs font-medium text-font/60 dark:text-font-dark/60"}
                      >
                        Collateral Refund Address
                      </Text>
                      <FaInfoCircle />
                    </Flex>
                  </AbbreviationExplanationInfo>
                  {/* Error message next to label */}
                  {bitcoinAddressInputError && <span className="text-red-500 text-sm">{bitcoinAddressInputError}</span>}
                </div>
                <TextField.Root
                  className="w-full font-semibold text-sm border-0 text-font dark:text-font-dark"
                  size={"3"}
                  type="text"
                  value={props.btcAddress}
                  onChange={(e) => onBitcoinAddressChange(e.target.value)}
                >
                  <TextField.Slot className="p-1.5" />
                </TextField.Root>
              </Flex>
              {props.needMoonCard
                ? (
                  <>
                    <Separator size={"4"} />
                    <Flex direction={"column"} align={"start"} gap={"2"}>
                      <Text as="label" className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
                        Choose a card
                      </Text>
                      <MoonCardDropdown
                        cards={props.moonCards}
                        onSelect={props.setMoonCardId}
                        loanAmount={props.amount}
                      />
                    </Flex>
                    <Separator size={"4"} />
                  </>
                )
                : null}
              {props.needLoanAddress
                ? (
                  <>
                    <Separator size={"4"} />
                    <Flex direction={"column"} align={"start"} gap={"2"}>
                      <Text as="label" className={"text-font dark:text-font-dark"} size={"2"} weight={"medium"}>
                        Wallet Address
                      </Text>
                      <LoanAddressInputField
                        loanAddress={props.loanAddress ?? ""}
                        setLoanAddress={props.setLoanAddress}
                        hideButton={hideWalletConnectButton}
                        setHideButton={setHideWalletConnectButton}
                        assetChain={StableCoinHelper.toChain(props.coin)}
                      />
                    </Flex>
                    <Separator size={"4"} />
                  </>
                )
                : null}
            </>
          )}
          {!props.offerPicked
            && (
              <Button
                size={"3"}
                variant="solid"
                className={`text-white bg-purple-950 w-full`}
                onClick={props.onOfferSelected}
              >
                <Text
                  size={"2"}
                  className="font-semibold"
                >
                  Pick Offer
                </Text>
              </Button>
            )}

          {props.offerPicked
            && (
              <Box className="flex space-x-4 justify-center">
                <Button
                  size={"3"}
                  variant="solid"
                  className={`text-white ${!walletSecretConfirmed ? "bg-purple-950" : "bg-gray-400"}`}
                  onClick={() => handleUnlockOrCreateWallet()}
                  disabled={walletSecretConfirmed}
                  loading={props.isLoading}
                >
                  <Text
                    size={"2"}
                    className="font-semibold"
                  >
                    Confirm Secret
                  </Text>
                </Button>
                <Button
                  size={"3"}
                  variant="solid"
                  className={`text-white ${confirmOfferButtonEnabled ? "bg-purple-950" : "bg-gray-400"}`}
                  onClick={props.onOfferConfirmed}
                  disabled={!confirmOfferButtonEnabled}
                  loading={props.isLoading}
                >
                  <Text
                    size={"2"}
                    className="font-semibold"
                  >
                    Confirm Offer
                  </Text>
                </Button>
              </Box>
            )}

          {props.error
            ? (
              <Box px={"2"} className="md:col-span-2">
                <Callout.Root color="red" className="w-full">
                  <Callout.Icon>
                    <FontAwesomeIcon icon={faWarning} />
                  </Callout.Icon>
                  <Callout.Text>
                    {props.error}
                  </Callout.Text>
                </Callout.Root>
              </Box>
            )
            : ""}
        </Box>
      </Box>
    </>
  );
};
