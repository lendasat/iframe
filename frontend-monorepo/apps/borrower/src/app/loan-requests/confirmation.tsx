import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useWallet } from "@frontend-monorepo/browser-wallet";
import { Integration, useAuth, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import {
  AbbreviationExplanationInfo,
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LoanAddressInputField,
  LtvInfoLabel,
  newFormatCurrency,
  ONE_YEAR,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Box, Button, Callout, DataList, Flex, Grid, Heading, Skeleton, Text, TextField } from "@radix-ui/themes";
import axios from "axios";
import { Network, validate } from "bitcoin-address-validation";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import EmptyResult from "../../assets/search.png";
import { Lender } from "../request-loan/lender";
import { MoonCardDropdown } from "../request-loan/steps/MoonCardDropdown";

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

interface ConfirmationProps {
  selectedProduct?: LoanProductOption;
  selectedOfferId?: string;
  selectedLoanAmount?: string;
  selectedLoanDuration?: string;
}

const EmptyInfoMessage = () => {
  return (
    <Box minHeight={"500px"} className="flex flex-col items-center justify-center">
      <img
        src={EmptyResult}
        alt="No Result"
        className="max-w-xs"
      />
      <Text className="text-font/90 dark:text-font-dark/90" size={"2"} weight={"medium"}>
        No offer selected...
      </Text>
    </Box>
  );
};

export const Confirmation = ({
  selectedProduct,
  selectedOfferId,
  selectedLoanAmount: selectedLoanAmountString,
  selectedLoanDuration: selectedLoanDurationString,
}: ConfirmationProps) => {
  const navigate = useNavigate();
  const { getLoanOffer, getUserCards, postContractRequest } = useBorrowerHttpClient();
  const { latestPrice } = usePrice();
  const { user } = useAuth();
  const { getNextPublicKey } = useWallet();
  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [moonCardId, setMoonCardId] = useState<string | undefined>();
  const [loanAddress, setLoanAddress] = useState("");
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);
  // TODO: set this value
  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);

  const selectedLoanAmount = parseInt(selectedLoanAmountString || "0");
  const selectedLoanDuration = parseInt(selectedLoanDurationString || "0");

  const { loading, value: selectedOffer, error } = useAsync(async () => {
    if (!selectedOfferId) {
      return;
    }
    return getLoanOffer(selectedOfferId);
  }, [selectedOfferId]);

  const { loading: moonCardsLoading, value: maybeMoonCards, error: userCardsError } = useAsync(async () => {
    // Users located in the US cannot top up cards.
    if (await isInUS()) {
      return [];
    } else {
      return getUserCards();
    }
  });

  let moonCards = maybeMoonCards || [];

  const isStillLoading = loading || !selectedOffer;
  const ltv = selectedOffer?.min_ltv || 0;
  const interestRate = selectedOffer?.interest_rate || 0;
  const actualInterest = interestRate / (ONE_YEAR / selectedLoanDuration);
  const actualInterestUsdAmount = selectedLoanAmount * actualInterest;
  const collateralAmountBtc = selectedLoanAmount / latestPrice / ltv;
  const collateralUsdAmount = selectedLoanAmount / ltv;

  const discountedFee = user?.first_time_discount_rate || 0.0;
  const isDiscountedFeeApplied = discountedFee ? discountedFee > 0 : false;

  // TODO: once we have different origination fees, this won't be correct anymore.
  const originationFee = selectedOffer?.origination_fee[0].fee || 0.0;
  const discountedOriginationFee = originationFee - (originationFee * discountedFee);
  const originationFeeBtc = collateralAmountBtc * discountedOriginationFee;
  const originationFeeUsd = selectedLoanAmount * discountedOriginationFee;

  // TODO: the liquidation threshold should be synced with the backend
  const liquidationPrice = selectedLoanAmount / collateralAmountBtc * 0.95;

  const selectedCoin = selectedOffer
    ? StableCoinHelper.mapFromBackend(selectedOffer.loan_asset_chain, selectedOffer.loan_asset_type)
    : undefined;

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
    setBitcoinAddress(address);
  };

  const createOfferRequest = async () => {
    try {
      if (!selectedOfferId) {
        setIsCreatingRequest(false);
        setCreateRequestError("No offer selected");
        return;
      }

      setIsCreatingRequest(true);
      const borrowerPk = await getNextPublicKey();

      let integration = Integration.StableCoin;
      switch (selectedProduct) {
        case LoanProductOption.PayWithMoonDebitCard:
          integration = Integration.PayWithMoon;
          break;
        case LoanProductOption.StableCoins:
          integration = Integration.StableCoin;
          break;
        case LoanProductOption.BringinBankAccount:
        case LoanProductOption.BitrefillDebitCard:
          setCreateRequestError("Loan product not yet supported");
          break;
      }

      const res = await postContractRequest({
        loan_id: selectedOfferId,
        loan_amount: selectedLoanAmount,
        duration_days: selectedLoanDuration,
        borrower_btc_address: bitcoinAddress,
        borrower_pk: borrowerPk,
        borrower_loan_address: loanAddress,
        integration: integration,
        moon_card_id: moonCardId,
      });

      if (res !== undefined) {
        navigate(`/my-contracts/${res.id}`);
      } else {
        setCreateRequestError("Failed at posting request.");
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setCreateRequestError(`${error}`);
    } finally {
      setIsCreatingRequest(false);
    }
  };

  if (!selectedProduct || !selectedOfferId || !selectedLoanAmountString || !selectedLoanDurationString) {
    return <EmptyInfoMessage />;
  }

  return (
    <Grid align={"center"} columns={{ initial: "1", md: "2" }} gap="3" width="auto">
      <Box className="p-6 border border-gray-200 rounded-lg h-full">
        <Heading size="4" mb="4" className="text-font dark:text-font-dark">
          Summary to borrow <strong>{formatCurrency(selectedLoanAmount || 0)}</strong> for{" "}
          {getFormatedStringFromDays(selectedLoanDuration)}
        </Heading>
        <DataList.Root>
          <DataList.Item align="center">
            <DataList.Label minWidth="88px">Lender</DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              {isStillLoading
                ? <Skeleton loading={true}>Loading</Skeleton>
                : <Lender {...selectedOffer?.lender} showAvatar={false} />}
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">
              <Flex align={"center"} gap={"2"}>
                Interest
                <InterestRateInfoLabel>
                  <FaInfoCircle />
                </InterestRateInfoLabel>
              </Flex>
            </DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              <Skeleton loading={isStillLoading}>
                <div className="flex flex-col">
                  {selectedLoanDuration !== ONE_YEAR
                    && (
                      <Flex gap={"2"}>
                        <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70">
                          {(actualInterest * 100).toFixed(2)}%
                        </Text>
                        <Text className="text-[11px] text-font/70 dark:text-font-dark/50 mt-0.5 self-end">
                          ({(interestRate * 100).toFixed(1)}% p.a.)
                        </Text>
                      </Flex>
                    )}
                  {selectedLoanDuration === ONE_YEAR
                    && (
                      <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70">
                        {(actualInterest * 100).toFixed(2)}% p.a.
                      </Text>
                    )}
                  <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                    ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
                  </Text>
                </div>
              </Skeleton>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">
              <Flex align={"center"} gap={"2"}>
                <Flex direction={"column"}>
                  <p>Needed collateral</p>
                  <Text size={"1"}>({(ltv * 100).toFixed(0)}% LTV)</Text>
                </Flex>
                <LtvInfoLabel>
                  <FaInfoCircle />
                </LtvInfoLabel>
              </Flex>
            </DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              <Skeleton loading={isStillLoading}>
                <div className="flex flex-col">
                  <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                    {collateralAmountBtc.toFixed(8)} BTC
                  </Text>
                  <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                    ≈ {formatCurrency(collateralUsdAmount)}
                  </Text>
                </div>
              </Skeleton>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">
              <div className="flex flex-col">
                <Flex align={"center"} gap={"2"}>
                  Origination fee
                </Flex>

                {isDiscountedFeeApplied
                  && (
                    <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-start">
                      {-(discountedFee * 100).toFixed(2)}% discount applied
                    </Text>
                  )}
              </div>
            </DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              <Skeleton loading={isStillLoading}>
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
              </Skeleton>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">
              <Flex align={"center"} gap={"2"}>
                Liquidation Price
                <LiquidationPriceInfoLabel>
                  <FaInfoCircle />
                </LiquidationPriceInfoLabel>
              </Flex>
            </DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              <Skeleton loading={isStillLoading}>
                {newFormatCurrency({ value: liquidationPrice, maxFraction: 0, minFraction: 1 })}
              </Skeleton>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">
              Coin
            </DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              <Skeleton loading={isStillLoading}>
                {selectedCoin ? StableCoinHelper.print(selectedCoin) : "Loading"}
              </Skeleton>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
        {(error || userCardsError) && (
          <Callout.Root color="tomato">
            <Callout.Icon>
              <IoInformationCircleOutline />
            </Callout.Icon>
            <Callout.Text>
              {error?.message || userCardsError?.message}
            </Callout.Text>
          </Callout.Root>
        )}
      </Box>
      <Box className="p-6 border border-gray-200 rounded-lg h-full">
        <Flex direction={"column"} gap={"2"}>
          <DataList.Root orientation={"vertical"}>
            <DataList.Item>
              <DataList.Label minWidth="88px">
                <Flex gap={"2"} align={"center"}>
                  Collateral Refund Address
                  <AbbreviationExplanationInfo
                    header={"Collateral Refund Address"}
                    subHeader={""}
                    description={"T"
                      + "he Bitcoin address where you want your collateral returned upon loan repayment."}
                  >
                    <FaInfoCircle />
                  </AbbreviationExplanationInfo>
                </Flex>
              </DataList.Label>
              <DataList.Value className="flex-1 flex justify-end">
                {isStillLoading
                  ? <Skeleton loading={true}>Loading</Skeleton>
                  : (
                    <Flex direction={"column"} className="w-full">
                      <TextField.Root
                        className="w-full font-semibold text-sm border-0 text-font dark:text-font-dark"
                        size={"3"}
                        type="text"
                        value={bitcoinAddress}
                        onChange={(e) => onBitcoinAddressChange(e.target.value)}
                      >
                        <TextField.Slot className="p-1.5" />
                      </TextField.Root>
                      {bitcoinAddressInputError && (
                        <span className="text-red-500 text-sm">{bitcoinAddressInputError}</span>
                      )}
                    </Flex>
                  )}
              </DataList.Value>
            </DataList.Item>
            {selectedProduct === LoanProductOption.PayWithMoonDebitCard
              && (
                <DataList.Item>
                  <DataList.Label minWidth="88px">
                    Choose a card
                  </DataList.Label>
                  <DataList.Value className="flex-1 flex justify-end">
                    {moonCardsLoading
                      ? <Skeleton>Loading</Skeleton>
                      : (
                        <MoonCardDropdown
                          cards={moonCards}
                          onSelect={setMoonCardId}
                          loanAmount={selectedLoanAmount}
                        />
                      )}
                  </DataList.Value>
                </DataList.Item>
              )}
            {selectedProduct === LoanProductOption.StableCoins
              && (
                <DataList.Item>
                  <DataList.Label minWidth="88px">
                    Wallet Address
                  </DataList.Label>
                  <DataList.Value className="w-full">
                    {(isStillLoading || !selectedCoin)
                      ? <Skeleton loading={isStillLoading}>Loading</Skeleton>
                      : (
                        <LoanAddressInputField
                          loanAddress={loanAddress ?? ""}
                          setLoanAddress={setLoanAddress}
                          hideButton={hideWalletConnectButton}
                          setHideButton={setHideWalletConnectButton}
                          assetChain={StableCoinHelper.toChain(selectedCoin)}
                          renderWarning={true}
                        />
                      )}
                  </DataList.Value>
                </DataList.Item>
              )}
          </DataList.Root>
          <Button
            size={"3"}
            onClick={createOfferRequest}
            loading={isCreatingRequest}
            disabled={isStillLoading}
          >
            Pick Offer
          </Button>
          {createRequestError
            ? (
              <Box px={"2"} className="md:col-span-2">
                <Callout.Root color="red" className="w-full">
                  <Callout.Icon>
                    <FontAwesomeIcon icon={faWarning} />
                  </Callout.Icon>
                  <Callout.Text>
                    {createRequestError}
                  </Callout.Text>
                </Callout.Root>
              </Box>
            )
            : ""}
        </Flex>
      </Box>
    </Grid>
  );
};
