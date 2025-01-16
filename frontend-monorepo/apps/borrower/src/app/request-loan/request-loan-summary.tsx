import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UnlockWalletModal, useWallet } from "@frontend-monorepo/browser-wallet";
import { findBestOriginationFee, Integration, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import type { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import {
  formatCurrency,
  LoanAddressInputField,
  LtvInfoLabel,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Badge, Box, Button, Callout, Flex, Grid, Heading, Separator, Text, TextField } from "@radix-ui/themes";
import { Network, validate } from "bitcoin-address-validation";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { BiError } from "react-icons/bi";
import { FaInfoCircle } from "react-icons/fa";
import { IoIosArrowRoundBack } from "react-icons/io";
import { MdSecurity } from "react-icons/md";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { LoanFilter } from "./loan-offers-filter";
import type { SliderProps } from "./slider";
import { Slider } from "./slider";

type LocationState = {
  loanOffer: LoanOffer;
  loanFilter: LoanFilter;
};

export function RequestLoanSummary() {
  const location = useLocation();
  let loanOfferFromState: LoanOffer | undefined;
  let loanFilterFromState: LoanFilter | undefined;
  if (location.state) {
    const { loanOffer, loanFilter } = location.state as LocationState;
    loanOfferFromState = loanOffer;
    loanFilterFromState = loanFilter;
  }
  const { id } = useParams();
  const [loanOffer, setLoanOffer] = useState<LoanOffer | undefined>(loanOfferFromState);
  const { getLoanOffer } = useBorrowerHttpClient();

  useEffect(() => {
    if (!loanOfferFromState && id) {
      getLoanOffer(id).then((offer) => {
        setLoanOffer(offer);
      });
    } else if (loanOfferFromState) {
      // do nothing
    } else {
      console.log(`Error: no id nor state set}`);
    }
  }, [id, loanOfferFromState, setLoanOffer, getLoanOffer]);

  if (!loanOffer) {
    return <>loading...</>;
  } else {
    return <RequestLoanSummaryInner loanOffer={loanOffer} loanFilter={loanFilterFromState} />;
  }
}

interface RequestLoanSummaryInnerProps {
  loanOffer: LoanOffer;
  loanFilter?: LoanFilter;
}

export function RequestLoanSummaryInner({ loanOffer, loanFilter }: RequestLoanSummaryInnerProps) {
  const layout = window;
  const [error, setError] = useState("");
  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");

  const { latestPrice } = usePrice();

  const { postContractRequest } = useBorrowerHttpClient();

  // Initialize filters
  let initMonths = loanFilter?.period || loanOffer.duration_months_min;
  if (initMonths > loanOffer.duration_months_max) {
    initMonths = loanOffer.duration_months_max;
  }

  let initAmount = loanFilter?.amount || loanOffer.loan_amount_min;
  if (initAmount > loanOffer.loan_amount_max) {
    initAmount = loanOffer.loan_amount_max;
  }

  const initCoin = StableCoinHelper.mapFromBackend(loanOffer.loan_asset_chain, loanOffer.loan_asset_type);

  const [loanAmount, setLoanAmount] = useState<number>(initAmount);

  const [loanAddress, setLoanAddress] = useState("");

  // Only for local testing
  let defaultBtcAddress = "";
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
    defaultBtcAddress = "bcrt1qqpf790lnsavxe9ree00tp8dd550ddw76pluxyr02tn2rssj6dtnstxmagd";
  }

  const [btcAddress, setBtcAddress] = useState(defaultBtcAddress);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [loanDuration, setLoanDuration] = useState<number>(initMonths);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  const collateral = latestPrice ? (loanAmount / loanOffer.min_ltv / latestPrice) : undefined;
  const collateralInUsd = collateral ? collateral * latestPrice : undefined;

  const bestOriginationFee = findBestOriginationFee(loanOffer.origination_fee, loanDuration);

  const loanOriginatorFee = latestPrice ? ((loanAmount / latestPrice) * bestOriginationFee) : undefined;

  const handleLoanAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setLoanAmount(value);

    // Validation
    if (isNaN(value)) {
      setAmountError("Amount is required");
    } else if (value < loanOffer.loan_amount_min || value > loanOffer.loan_amount_max) {
      setAmountError(
        `Amount must be between ${formatCurrency(loanOffer.loan_amount_min)} and ${
          formatCurrency(loanOffer.loan_amount_max)
        }`,
      );
    } else {
      setAmountError(null);
    }
  };

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const navigate = useNavigate();

  const { doesWalletExist, isWalletLoaded, getNextPublicKey } = useWallet();

  const handleRequestLoan = async () => {
    try {
      if (!doesWalletExist) {
        throw new Error("Wallet does not exist. Try to log back in");
      }
      if (!isWalletLoaded) {
        handleOpenUnlockWalletModal();
        return;
      }

      await requestLoan();
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    }
  };

  const requestLoan = async () => {
    try {
      const borrowerPk = await getNextPublicKey();

      const res = await postContractRequest({
        loan_id: loanOffer.id,
        loan_amount: loanAmount || 0,
        duration_months: loanDuration,
        borrower_btc_address: btcAddress,
        borrower_pk: borrowerPk,
        borrower_loan_address: loanAddress,
        integration: Integration.StableCoin,
      });

      if (res !== undefined) {
        navigate("/my-contracts");
      } else {
        // Handle error if needed
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    }
  };

  const periodSliderProps: SliderProps = {
    min: loanOffer.duration_months_min,
    max: loanOffer.duration_months_max,
    step: 1,
    init: loanDuration,
    suffix: " months",
    onChange: (duration) => {
      setLoanDuration(duration);
    },
  };

  const addressLabel = initCoin ? `${StableCoinHelper.print(initCoin)} address` : "Address";

  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const minLtv = loanOffer.min_ltv * 100;

  const interestAmountUsd = loanAmount * (loanOffer.interest_rate / 12 * loanDuration);

  const totalAmount = collateral && loanOriginatorFee ? (collateral + loanOriginatorFee) : undefined;
  const totalAmountUsd = totalAmount ? totalAmount * latestPrice : undefined;

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
    setBtcAddress(address);
  };

  const isButtonDisabled = loanAmount === undefined
    || loanAmount < loanOffer.loan_amount_min
    || loanAmount > loanOffer.loan_amount_max
    || amountError != null
    || !initCoin
    || !loanAddress.trim()
    || !!bitcoinAddressInputError;

  const originationFeeUsd = formatCurrency(loanAmount * bestOriginationFee);
  return (
    <Box
      className="overflow-y-scroll p-3 pb-16 md:p-5 lg:p-8"
      style={{
        height: layout.innerHeight - 130,
      }}
    >
      <Grid className="md:grid-cols-4 lg:grid-cols-5 gap-5 items-center">
        <Box className="md:col-span-2 lg:col-span-3">
          <Box className="flex items-center gap-3">
            <Link to="/request-loan">
              <IoIosArrowRoundBack size={30} />
            </Link>
            <Heading size={"8"} className="text-font dark:text-font-dark">Details</Heading>
            <Badge variant="soft" size={"2"} color="gray" radius="medium">
              Draft
            </Badge>
          </Box>
          <Box mt={"7"}>
            <Text weight={"medium"} size={"2"}>Please enter your preferred loan details</Text>
            <Box mt={"4"} className="border border-font/20 rounded-lg p-4 md:p-6 space-y-5">
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>Amount</Text>
                <TextField.Root
                  className="w-full font-semibold border-0"
                  size={"3"}
                  variant="surface"
                  type="number"
                  color={amountError ? "red" : "gray"}
                  value={loanAmount !== undefined ? loanAmount : ""}
                  onChange={handleLoanAmountChange}
                >
                  <TextField.Slot>
                    <Text size={"3"} weight={"medium"}>$</Text>
                  </TextField.Slot>

                  {amountError
                    && (
                      <TextField.Slot>
                        <BiError color={"red"} className="" />
                      </TextField.Slot>
                    )}
                </TextField.Root>
                {amountError && <Text as="span" size={"1"} color="red" weight={"medium"}>{amountError}</Text>}
              </Flex>
              <Separator size={"4"} />
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>Loan Duration</Text>
                <Slider {...periodSliderProps} />
              </Flex>
              <Separator size={"4"} />
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <div className="flex items-center gap-2">
                  <Text as="label" size={"2"} weight={"medium"}>
                    Bitcoin Refund Address
                  </Text>
                  {/* Error message next to label */}
                  {bitcoinAddressInputError && <span className="text-red-500 text-sm">{bitcoinAddressInputError}</span>}
                </div>
                <TextField.Root
                  className="w-full font-semibold text-sm border-0"
                  size={"3"}
                  color="gray"
                  type="text"
                  value={btcAddress}
                  onChange={(e) => onBitcoinAddressChange(e.target.value)}
                >
                  <TextField.Slot className="p-1.5" />
                </TextField.Root>
              </Flex>
              <Separator size={"4"} />
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>{addressLabel}</Text>
                <LoanAddressInputField
                  loanAddress={loanAddress}
                  setLoanAddress={setLoanAddress}
                  assetChain={loanOffer.loan_asset_chain}
                  hideButton={hideWalletConnectButton}
                  setHideButton={setHideWalletConnectButton}
                />
              </Flex>
            </Box>
          </Box>
        </Box>
        <Box className="md:col-span-2" p={"2"}>
          <Box className="bg-active-nav/10 rounded-xl p-5 py-10 md:p-10 md:pt-16 h-full">
            <Flex className="items-center justify-center">
              <Box width={"100%"}>
                <Box className="flex flex-col items-center gap-5">
                  <Text className="font-semibold" size={"2"}>To Receive</Text>
                  <Heading as="h4" size={"8"} weight={"bold"} className="text-font-dark">
                    {loanAmount ? formatCurrency(loanAmount) : "$0"}
                  </Heading>
                  <Box className="flex items-center justify-center gap-1">
                    <MdSecurity className="text-green-700" />
                    <Text size={"1"} weight={"medium"} className="text-font/70">Secured</Text>
                  </Box>
                </Box>
                <Separator size={"4"} my={"7"} />
                <Box>
                  <Text className="font-semibold" size={"2"}>Loan Summary</Text>

                  <Box mt={"6"} className="flex flex-col gap-4">
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Lender</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {loanOffer.lender.name}
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Coin</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {initCoin ? StableCoinHelper.print(initCoin) : ""}
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Duration</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {loanDuration} Months
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <LtvInfoLabel>
                        <Text className="text-xs font-medium text-font/60">LTV ratio</Text>
                        <FaInfoCircle color={"gray"} />
                      </LtvInfoLabel>

                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {minLtv.toFixed(0)}%
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Interest Rate</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {(loanOffer.interest_rate * 100).toFixed(2)}%
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"start"}>
                      <Text className="text-xs font-medium text-font/60">Interest to be paid on maturity</Text>
                      <Box className="text-end">
                        <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                          {formatCurrency(interestAmountUsd)}
                        </Text>
                      </Box>
                    </Flex>
                  </Box>

                  <Separator size={"4"} my={"4"} />

                  <Box className="flex flex-col gap-4">
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Collateral</Text>
                      <Box className="text-end">
                        <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                          {collateral?.toFixed(8)} BTC
                        </Text>
                        <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                          ~{collateralInUsd ? formatCurrency(collateralInUsd) : "loading..."}
                        </Text>
                      </Box>
                    </Flex>

                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60"></Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                      </Text>
                    </Flex>

                    <Flex justify={"between"} align={"start"}>
                      <Text className="text-xs font-medium text-font/60">
                        Origination fee ({(bestOriginationFee * 100).toFixed(1)}%)
                      </Text>
                      <Box className="text-end">
                        <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                          {loanOriginatorFee?.toFixed(8)} BTC
                        </Text>
                        <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                          ~{loanAmount ? originationFeeUsd : "0"}
                        </Text>
                      </Box>
                    </Flex>
                  </Box>
                </Box>
                <Separator size={"4"} my={"4"} />
                <Box className="flex flex-col gap-4">
                  <Flex justify={"between"} align={"start"}>
                    <Text className="text-xs font-medium text-font/60">Total lock-up amount</Text>
                    <Box className="text-end">
                      <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                        {totalAmount?.toFixed(8)} BTC
                      </Text>
                      <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                        ~{totalAmountUsd ? formatCurrency(totalAmountUsd) : "0"}
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              </Box>
            </Flex>
          </Box>
        </Box>
        <Box className="md:col-span-2 lg:col-span-3">
          <Button
            variant="solid"
            size={"3"}
            color="purple"
            className="w-full font-semibold"
            onClick={handleRequestLoan}
            disabled={isButtonDisabled}
          >
            {isWalletLoaded ? "Request" : "Load Wallet"}
          </Button>
        </Box>
        <UnlockWalletModal
          show={showUnlockWalletModal}
          handleClose={handleCloseUnlockWalletModal}
          handleSubmit={handleSubmitUnlockWalletModal}
        />

        <Box px={"2"} className="md:col-span-2">
          {error
            ? (
              <Callout.Root color="red" className="w-full">
                <Callout.Icon>
                  <FontAwesomeIcon icon={faWarning} />
                </Callout.Icon>
                <Callout.Text>
                  {error}
                </Callout.Text>
              </Callout.Root>
            )
            : ""}
        </Box>
      </Grid>
    </Box>
  );
}
