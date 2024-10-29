import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CreateWalletModal, UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import type { LoanOffer, LoanProductOption } from "@frontend-monorepo/http-client-borrower";
import { useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { StableCoin } from "@frontend-monorepo/ui-shared";
import {
  formatCurrency,
  LoanAddressInputField,
  LtvInfoLabel,
  StableCoinDropdown,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, Flex, Grid, Heading, Separator, Spinner, Text, TextField } from "@radix-ui/themes";
import { Network, validate } from "bitcoin-address-validation";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { Form } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import EmptyResult from "../../../assets/search.png";

interface OfferFilter {
  loanAmount?: number;
  duration: number | undefined;
  minLtv: number | undefined;
  maxInterest: number | undefined;
  wantedCoin: StableCoin | undefined;
  availableOffers: LoanOffer[];
  advanceSearch: boolean;
}

const findBestOffer = ({
  loanAmount,
  duration,
  wantedCoin,
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

  console.log(`Selected option ${selectedOption}`);

  const [advanceSearch, setAdvanceSearch] = useState<boolean>(false);
  const [bestOffer, setBestOffer] = useState<LoanOffer | undefined>();
  // Loan Amount
  const [loanAmount, setLoanAmount] = useState<number>(1);
  // Stable Coin
  const [stableCoin, setStableCoin] = useState<StableCoin | undefined>(undefined);
  // Loan Duration
  const [loanDuration, setLoanDuration] = useState<number>(12);
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
  const [loanAddress, setLoanAddress] = useState("");
  const [btcAddress, setBtcAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [offerPicked, setOfferPicked] = useState<boolean>(false);

  const { loading, value: maybeAvailableOffers, error: loadingError } = useAsync(async () => {
    return getLoanOffers();
  }, []);

  if (loadingError) {
    console.error(`Failed loading loan offers ${loadingError}`);
  }

  if (loading) {
    // TODO: might be nicer to use a skeleton
    return <Spinner />;
  }

  const availableOffers = maybeAvailableOffers || [];

  const onShowOfferClick = () => {
    const loanOffer = findBestOffer({
      loanAmount: loanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      minLtv: ltv,
      maxInterest: maxInterest,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(loanOffer);
  };

  function onLoanAmountChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedLoanAmount = parseFloat(e.target.value);
    if (isNaN(parsedLoanAmount)) {
      parsedLoanAmount = 1;
    }
    setLoanAmount(parsedLoanAmount);
    const refreshedBestOffer = findBestOffer({
      loanAmount: parsedLoanAmount,
      duration: loanDuration,
      wantedCoin: stableCoin,
      minLtv: ltv,
      maxInterest: maxInterest,
      availableOffers: availableOffers,
      advanceSearch: advanceSearch,
    });
    setBestOffer(refreshedBestOffer);
  }

  function onLoanDurationChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    let parsedDuration = parseFloat(e.target.value);
    if (isNaN(parsedDuration)) {
      parsedDuration = 1;
    }
    setLoanDuration(parsedDuration);
    const refreshedBestOffer = findBestOffer({
      loanAmount: loanAmount,
      duration: parsedDuration,
      wantedCoin: stableCoin,
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

  return (
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
                    setAdvanceSearch(!advanceSearch);
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
                    setAdvanceSearch(!advanceSearch);
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
                    <LtvInfoLabel>
                      <Text as="label" className="text-sm font-medium text-font">
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
                Show best offer
              </Button>
            </Box>
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
                    )}
                    loanAddress={loanAddress}
                    setLoanAddress={setLoanAddress}
                    btcAddress={btcAddress}
                    setBtcAddress={setBtcAddress}
                    offerPicked={offerPicked}
                    setOfferPicked={() => setOfferPicked(true)}
                    error={error}
                    setError={setError}
                    onOfferConfirmed={async () => {
                      await requestLoan();
                    }}
                    onOfferSelected={() => {
                      setOfferPicked(true);
                    }}
                    isLoading={isLoading}
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
                  No offers found for these inputs...
                </Text>
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
  loanAddress: string;
  setLoanAddress: (val: string) => void;
  btcAddress: string;
  setBtcAddress: (val: string) => void;
  setError: (val: string) => void;
  error: string;
  isLoading: boolean;
}

// Loan Display Component
const LoanSearched = (props: SearchParams) => {
  const { doesWalletExist, isWalletLoaded } = useWallet();

  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");
  const [walletSecretConfirmed, setWalletSecretConfirmed] = useState(isWalletLoaded);
  const { latestPrice } = usePrice();
  const collateralAmountBtc = props.amount / latestPrice;
  const collateralUsdAmount = props.amount / props.ltv;

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
      props.setError(`Failed setting contract password ${error}`);
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
            <Text className="text-xs font-medium text-font/60">Lender</Text>
            <Text className="text-[13px] font-semibold text-black/70 capitalize">
              {props.lender}
            </Text>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <Text className="text-xs font-medium text-font/60">Interest</Text>
            <Text className="text-[13px] font-semibold text-black/70">
              {(props.interest * 100).toFixed(1)}% per year
            </Text>
          </Flex>
          <Separator size={"4"} />
          <Flex justify={"between"} align={"center"}>
            <Text className="text-xs font-medium text-font/60">
              Needed collateral ({(props.ltv * 100).toFixed(0)}% LTV)
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
          {props.offerPicked && (
            <>
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <div className="flex items-center gap-2">
                  <Text as="label" size={"2"} weight={"medium"}>
                    Collateral Refund Address
                  </Text>
                  {/* Error message next to label */}
                  {bitcoinAddressInputError && <span className="text-red-500 text-sm">{bitcoinAddressInputError}</span>}
                </div>
                <TextField.Root
                  className="w-full font-semibold text-sm border-0"
                  size={"3"}
                  color="gray"
                  type="text"
                  value={props.btcAddress}
                  onChange={(e) => onBitcoinAddressChange(e.target.value)}
                >
                  <TextField.Slot className="p-1.5" />
                </TextField.Root>
              </Flex>
              <Separator size={"4"} />
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>Wallet Address</Text>
                <LoanAddressInputField
                  loanAddress={props.loanAddress}
                  setLoanAddress={props.setLoanAddress}
                  hideButton={hideWalletConnectButton}
                  setHideButton={setHideWalletConnectButton}
                  assetChain={StableCoinHelper.toChain(props.coin)}
                />
              </Flex>
              <Separator size={"4"} />
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
              <Flex className="gap-4 justify-center">
                <Button
                  size={"3"}
                  variant="solid"
                  className={`text-white ${!walletSecretConfirmed ? "bg-purple-950" : "bg-gray-400"} w-1/3`}
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
                  className={`text-white ${walletSecretConfirmed ? "bg-purple-950" : "bg-gray-400"} w-1/3`}
                  onClick={props.onOfferConfirmed}
                  disabled={!walletSecretConfirmed}
                  loading={props.isLoading}
                >
                  <Text
                    size={"2"}
                    className="font-semibold"
                  >
                    Confirm Offer
                  </Text>
                </Button>
              </Flex>
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
