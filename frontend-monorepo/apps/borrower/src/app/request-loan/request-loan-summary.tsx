import { faInfoCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWallet } from "@frontend-monorepo/borrower-wallet";
import { LoanOffer, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import { formatCurrency, usePrice } from "@frontend-monorepo/ui-shared";
import {
  Badge,
  Box,
  Button,
  Callout,
  Container,
  Flex,
  Grid,
  Heading,
  IconButton,
  Separator,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import React, { useState } from "react";
import { BiError, BiSolidCopy } from "react-icons/bi";
import { IoIosArrowRoundBack } from "react-icons/io";
import { MdSecurity } from "react-icons/md";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CreateWalletModal } from "../wallet/create-wallet-modal";
import { UnlockWalletModal } from "../wallet/unlock-wallet-modal";
import { LoanFilter } from "./loan-offers-filter";
import { Slider, SliderProps } from "./slider";
import { StableCoin, StableCoinHelper } from "./stable-coin";

type LocationState = {
  loanOffer: LoanOffer;
  loanFilter: LoanFilter;
};

export function RequestLoanSummary() {
  const location = useLocation();
  const { loanOffer, loanFilter } = location.state as LocationState;
  const [error, setError] = useState("");

  const ORIGINATOR_FEE = 0.01;
  const { latestPrice } = usePrice();

  const { postContractRequest } = useBorrowerHttpClient();

  // Initialize filters
  let initMonths = loanFilter.period || loanOffer.duration_months_min;
  if (initMonths > loanOffer.duration_months_max) {
    initMonths = loanOffer.duration_months_max;
  }

  let initAmount = loanFilter.amount || loanOffer.loan_amount_min;
  if (initAmount > loanOffer.loan_amount_max) {
    initAmount = loanOffer.loan_amount_max;
  }

  const initCoin = StableCoinHelper.mapFromBackend(loanOffer.loan_asset_chain, loanOffer.loan_asset_type);

  const [loanAmount, setLoanAmount] = useState<number>(initAmount);
  const [selectedCoin, setSelectedCoin] = useState<StableCoin>(initCoin!);

  const [loanAddress, setLoanAddress] = useState("");

  // Only for local testing
  let defaultBtcAddress = "";
  if (import.meta.env.VITE_BITCOIN_NETWORK === "regtest") {
    defaultBtcAddress = "bcrt1qqpf790lnsavxe9ree00tp8dd550ddw76pluxyr02tn2rssj6dtnstxmagd";
  }
  if (import.meta.env.VITE_BITCOIN_NETWORK === "signet") {
    defaultBtcAddress = "tb1q54wsjqzdm0fmqzezuzq00x9tramznhfa7zw6y0";
  }

  const [btcAddress, setBtcAddress] = useState(defaultBtcAddress);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [loanDuration, setLoanDuration] = useState<number>(initMonths);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showUnlockWalletModal, setShowUnlockWalletModal] = useState(false);

  const collateral = latestPrice ? (loanAmount / (loanOffer.min_ltv / 100) / latestPrice) : undefined;

  const loanOriginatorFee = latestPrice ? ((loanAmount / latestPrice) * ORIGINATOR_FEE) : undefined;

  const handleLoanAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleCloseCreateWalletModal = () => setShowCreateWalletModal(false);
  const handleOpenCreateWalletModal = () => setShowCreateWalletModal(true);

  const handleCloseUnlockWalletModal = () => setShowUnlockWalletModal(false);
  const handleOpenUnlockWalletModal = () => setShowUnlockWalletModal(true);

  const navigate = useNavigate();

  const { doesWalletExist, isWalletLoaded, getNextPublicKey } = useWallet();

  const handleRequestLoan = async () => {
    try {
      if (!doesWalletExist) {
        handleOpenCreateWalletModal();
        return;
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
      const borrowerPk = getNextPublicKey();

      const res = await postContractRequest({
        loan_id: loanOffer.id,
        loan_amount: loanAmount || 0,
        duration_months: loanDuration,
        borrower_btc_address: btcAddress,
        borrower_pk: borrowerPk,
        borrower_loan_address: loanAddress,
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

  const handleCoinSelect = (coin: StableCoin) => {
    setSelectedCoin(coin);
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

  const isButtonDisabled = loanAmount === undefined
    || loanAmount < loanOffer.loan_amount_min
    || loanAmount > loanOffer.loan_amount_max
    || amountError != null
    || !selectedCoin
    || !loanAddress.trim();

  const addressLabel = selectedCoin ? `${StableCoinHelper.print(selectedCoin)} address` : "Address";

  const handleSubmitCreateWalletModal = async () => {
    handleCloseCreateWalletModal();
  };
  const handleSubmitUnlockWalletModal = async () => {
    handleCloseUnlockWalletModal();
  };

  const minLtv = loanOffer.min_ltv * 100;

  return (
    <Box className="bg-white h-screen overflow-y-scroll p-3 pb-16 md:p-5 lg:p-8">
      <Grid className="md:grid-cols-4 lg:grid-cols-5 gap-5 items-center">
        <Box className="md:col-span-2 lg:col-span-3">
          <Box className="flex items-center gap-3">
            <Link to="/request-loan">
              <IoIosArrowRoundBack size={30} />
            </Link>
            <Heading size={"8"} className="text-font-dark">Details</Heading>
            <Badge variant="soft" size={"2"} color="gray" radius="medium">
              Draft
            </Badge>
          </Box>
          <Box mt={"7"}>
            <Text weight={"medium"} size={"2"}>Ticket Information</Text>
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
              <Flex direction={"row"} align={"center"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>Coin:</Text>
                <Badge color="gray" size={"3"}>
                  {initCoin}
                </Badge>
              </Flex>
              <Separator size={"4"} />
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>Bitcoin Refund Address</Text>
                <TextField.Root
                  className="w-full font-semibold text-sm border-0"
                  size={"3"}
                  color="gray"
                  type="text"
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                >
                  <TextField.Slot className="p-1.5" />
                </TextField.Root>
              </Flex>
              <Separator size={"4"} />
              <Flex direction={"column"} align={"start"} gap={"2"}>
                <Text as="label" size={"2"} weight={"medium"}>{addressLabel}</Text>
                {loanAddress && (
                  <Callout.Root color="amber">
                    <Callout.Icon>
                      <FontAwesomeIcon icon={faInfoCircle} />
                    </Callout.Icon>
                    <Callout.Text>
                      Provide a valid address on the target network. Providing an incorrect address here will lead to
                      loss of funds.
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
                    {loanAmount ? "$" + loanAmount : "$0"}
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
                      <Text className="text-xs font-medium text-font/60">Collateral</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {collateral?.toFixed(4)} BTC
                      </Text>
                    </Flex>
                  </Box>

                  <Separator size={"4"} my={"4"} />

                  <Box className="flex flex-col gap-4">
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Coin</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {initCoin}
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">LTV ratio</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {minLtv.toFixed(0)}%
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Interest rate P.A</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {loanOffer.interest_rate * 100}%
                      </Text>
                    </Flex>
                    <Flex justify={"between"} align={"center"}>
                      <Text className="text-xs font-medium text-font/60">Duration</Text>
                      <Text className="text-[13px] font-semibold text-black/70 capitalize">
                        {loanDuration} Months
                      </Text>
                    </Flex>
                  </Box>
                </Box>
                <Separator size={"4"} my={"4"} />
                <Box className="flex flex-col gap-4">
                  <Flex justify={"between"} align={"start"}>
                    <Text className="text-xs font-medium text-font/60">1% Originator fee</Text>
                    <Box className="text-end">
                      <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                        {loanOriginatorFee?.toFixed(4)} BTC
                      </Text>
                      <Text className="text-[13px] block font-semibold text-black/70 capitalize">
                        ~{loanAmount ? formatCurrency(loanAmount * ORIGINATOR_FEE) : "0"}
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
            {doesWalletExist ? isWalletLoaded ? "Request" : "Load Wallet" : "Create Wallet"}
          </Button>
        </Box>
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
