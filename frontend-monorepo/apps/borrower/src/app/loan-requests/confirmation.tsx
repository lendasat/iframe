import { faCheckCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
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
import {
  AlertDialog,
  Box,
  Button,
  Callout,
  Checkbox,
  DataList,
  Dialog,
  Flex,
  Grid,
  Heading,
  Link,
  Skeleton,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import axios from "axios";
import { Network, validate } from "bitcoin-address-validation";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
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
  const [bitcoinAddressValid, setBitcoinAddressValid] = useState(false);
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [moonCardId, setMoonCardId] = useState<string | undefined>();
  const [loanAddress, setLoanAddress] = useState("");
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);
  // TODO: set this value
  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);

  // inside KYC dialog
  const [isKycChecked, setIsKycChecked] = useState(false);
  // outside
  const [kycFormDialogConfirmed, setKycFormDialogConfirmed] = useState(false);

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
      setBitcoinAddressValid(false);
    } else {
      setBitcoinAddressInputError("");
      setBitcoinAddressValid(true);
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

      if (!bitcoinAddress || bitcoinAddress.trim().length === 0 || !bitcoinAddressValid) {
        setCreateRequestError("No valid bitcoin address provided");
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

      if (integration === Integration.StableCoin && !loanAddress || loanAddress.trim().length === 0) {
        setCreateRequestError("No address provided");
        return;
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

  return (
    <Grid align={"center"} columns={{ initial: "1", md: "2" }} gap="3" width="auto">
      <Box className="p-6 border border-gray-200 rounded-lg h-full">
        <Heading size="4" mb="4" className="text-font dark:text-font-dark">
          Summary to borrow{" "}
          <Skeleton loading={isStillLoading}>
            <strong>{formatCurrency(selectedLoanAmount || 0)}</strong>
          </Skeleton>{" "}
          for{" "}
          <Skeleton loading={isStillLoading}>
            {getFormatedStringFromDays(selectedLoanDuration)}
          </Skeleton>
        </Heading>
        <DataList.Root>
          <DataList.Item align="center">
            <DataList.Label minWidth="88px">Lender</DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              {isStillLoading
                ? (
                  <Skeleton loading={isStillLoading} width={"100px"} height={"20px"}>
                  </Skeleton>
                )
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
              {isStillLoading
                ? (
                  <Skeleton loading={isStillLoading} width={"100px"} height={"20px"}>
                  </Skeleton>
                )
                : (
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
                )}
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
              {isStillLoading
                ? (
                  <Skeleton loading={isStillLoading} width={"100px"} height={"20px"}>
                  </Skeleton>
                )
                : (
                  <div className="flex flex-col">
                    <Text className="text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize">
                      {collateralAmountBtc.toFixed(8)} BTC
                    </Text>
                    <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-end">
                      ≈ {formatCurrency(collateralUsdAmount)}
                    </Text>
                  </div>
                )}
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
              {isStillLoading
                ? (
                  <Skeleton loading={isStillLoading} width={"100px"} height={"20px"}>
                  </Skeleton>
                )
                : (
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
                )}
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
              {isStillLoading
                ? (
                  <Skeleton loading={isStillLoading} width={"100px"} height={"20px"}>
                  </Skeleton>
                )
                : (
                  <Text
                    className={`text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize ${
                      discountedFee === 1 ? "line-through" : ""
                    }`}
                  >
                    {newFormatCurrency({ value: liquidationPrice, maxFraction: 0, minFraction: 1 })}
                  </Text>
                )}
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">
              Coin
            </DataList.Label>
            <DataList.Value className="flex-1 flex justify-end">
              {isStillLoading
                ? (
                  <Skeleton loading={isStillLoading} width={"100px"} height={"20px"}>
                  </Skeleton>
                )
                : (
                  <Text
                    className={`text-[13px] font-semibold text-font/70 dark:text-font-dark/70 capitalize ${
                      discountedFee === 1 ? "line-through" : ""
                    }`}
                  >
                    {selectedCoin ? StableCoinHelper.print(selectedCoin) : ""}
                  </Text>
                )}
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
                    description={"The Bitcoin address where you want your collateral returned upon loan repayment."}
                  >
                    <RadixLink
                      href="https://faq.lendasat.com"
                      target="_blank"
                    >
                      <FaInfoCircle />
                    </RadixLink>
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

            {selectedOffer?.kyc_link
              && (
                <DataList.Item>
                  <DataList.Label minWidth="88px">
                    KYC Required
                  </DataList.Label>
                  <DataList.Value className="flex-1 flex justify-end">
                    {isStillLoading
                      ? <Skeleton loading={true}></Skeleton>
                      : (
                        <Flex direction={"column"}>
                          <Callout.Root color={kycFormDialogConfirmed ? "green" : "amber"} className="w-full">
                            <Callout.Icon>
                              <FontAwesomeIcon icon={kycFormDialogConfirmed ? faCheckCircle : faWarning} />
                            </Callout.Icon>
                            <Callout.Text>
                              <Text>
                                Identity verification is required. Please complete the lender's KYC form. You can
                                continue while the verification is in progress.
                                <br />
                                <Dialog.Root>
                                  <Dialog.Trigger>
                                    <Button color={"purple"}>KYC Form</Button>
                                  </Dialog.Trigger>

                                  <Dialog.Content style={{ maxWidth: "450px" }}>
                                    <Flex direction="column" gap="4">
                                      <Dialog.Title>KYC Required</Dialog.Title>

                                      <Text as="p">
                                        For this offer KYC is required. KYC verification is performed by the lender and
                                        we do not know if you have processed or succeeded KYC with them in the past.
                                      </Text>

                                      <Flex justify="center" py="4">
                                        <Link
                                          href={selectedOffer?.kyc_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          weight="medium"
                                        >
                                          Access KYC Form →
                                        </Link>
                                      </Flex>

                                      <Text as="p">
                                        If this is your first time requesting from this lender, please proceed to their
                                        KYC form to initiate the procedure.
                                      </Text>

                                      <Text as="p">
                                        Meanwhile, you can continue requesting the offer through Lendasat. Once the KYC
                                        request has been approved, the Lender will accept your loan request.
                                      </Text>

                                      <Flex gap="2" align="center">
                                        <Checkbox
                                          checked={isKycChecked}
                                          onCheckedChange={(c) => setIsKycChecked(c === true)}
                                          id="kyc-confirm"
                                        />
                                        <Text as="label" htmlFor="kyc-confirm">
                                          I confirm I've submitted the KYC
                                        </Text>
                                      </Flex>

                                      <Flex gap="3" justify="end" mt="4">
                                        <Dialog.Close>
                                          <Button variant="soft" color="gray">
                                            Cancel
                                          </Button>
                                        </Dialog.Close>
                                        <Dialog.Close>
                                          <Button
                                            disabled={!isKycChecked}
                                            onClick={() => setKycFormDialogConfirmed(true)}
                                          >
                                            Confirm
                                          </Button>
                                        </Dialog.Close>
                                      </Flex>
                                    </Flex>
                                  </Dialog.Content>
                                </Dialog.Root>
                              </Text>
                            </Callout.Text>
                          </Callout.Root>
                        </Flex>
                      )}
                  </DataList.Value>
                </DataList.Item>
              )}
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
                    Loan address
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
