import { faCheckCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  FiatLoanDetails,
  LoanProductOption,
} from "@frontend/http-client-borrower";
import { useWallet } from "@frontend/browser-wallet";
import {
  LoanType,
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  AbbreviationExplanationInfo,
  FiatDialogFormDetails,
  FiatTransferDetails,
  FiatTransferDetailsDialog,
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LoanAddressInputField,
  LoanAssetHelper,
  LtvInfoLabel,
  newFormatCurrency,
  ONE_YEAR,
  usePrice,
} from "@frontend/ui-shared";
import {
  Box,
  Callout,
  DataList,
  Flex,
  Grid,
  Heading,
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
import { Link, useNavigate } from "react-router-dom";
import { useAsync } from "react-use";
import { KycDialog } from "./kyc-dialog";
import { Lender } from "./lender";
import { MoonCardDropdown } from "./MoonCardDropdown";
import { ToS } from "./tos";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Button, Alert, AlertDescription, AlertTitle } from "@frontend/shadcn";
import { LuLoader } from "react-icons/lu";

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
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { hasBringinApiKey: getHasBringinApiKey } = useHttpClientBorrower();

  const { loading: apiKeyLoading, value: maybeApiKey } = useAsync(async () => {
    return await getHasBringinApiKey();
  });

  const hasBriningApiKey = !apiKeyLoading && maybeApiKey;

  const { getLoanOffer, getUserCards, postContractRequest } =
    useHttpClientBorrower();
  const { latestPrice } = usePrice();
  const { user } = useAuth();
  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");
  const [bitcoinAddressValid, setBitcoinAddressValid] = useState(false);
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [moonCardId, setMoonCardId] = useState<string | undefined>();
  const [loanAddress, setLoanAddress] = useState("");
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);
  // TODO: set this value
  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [fiatTransferDetailsConfirmed, setFiatTransferDetailsConfirmed] =
    useState(false);
  const [encryptedFiatTransferDetails, setEncryptedFiatTransferDetails] =
    useState<FiatLoanDetails>();
  const [fiatTransferDetails, setFiatTransferDetails] =
    useState<FiatDialogFormDetails>({
      bankDetails: {
        isIban: true,
        iban: "",
        bic: "",
        account_number: "",
        swift: "",
        bankName: "",
        bankAddress: "",
        bankCountry: "",
        purpose: "",
      },
      beneficiaryDetails: {
        fullName: "",
        address: "",
        city: "",
        zipCode: "",
        country: "",
        additionalComments: "",
      },
    });

  const [ownPk, setOwnPk] = useState<string | undefined>(undefined);
  const [ownPath, setOwnPath] = useState<string | undefined>(undefined);

  // inside KYC dialog
  const [isKycChecked, setIsKycChecked] = useState(false);
  // outside
  const [kycFormDialogConfirmed, setKycFormDialogConfirmed] = useState(false);

  const selectedLoanAmount = parseInt(selectedLoanAmountString || "0");
  const selectedLoanDuration = parseInt(selectedLoanDurationString || "0");

  const {
    loading,
    value: selectedOffer,
    error,
  } = useAsync(async () => {
    if (!selectedOfferId) {
      return;
    }
    return getLoanOffer(selectedOfferId);
  }, [selectedOfferId]);

  const {
    loading: moonCardsLoading,
    value: maybeMoonCards,
    error: userCardsError,
  } = useAsync(async () => {
    // Users located in the US cannot top up cards.
    if (await isInUS()) {
      return [];
    } else {
      return getUserCards();
    }
  });

  const moonCards = maybeMoonCards || [];

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
  const discountedOriginationFee =
    originationFee - originationFee * discountedFee;
  const originationFeeBtc = collateralAmountBtc * discountedOriginationFee;
  const originationFeeUsd = selectedLoanAmount * discountedOriginationFee;

  // TODO: the liquidation threshold should be synced with the backend
  const liquidationPrice = (selectedLoanAmount / collateralAmountBtc) * 0.95;

  const loanAsset = selectedOffer?.loan_asset;

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

  const unlockWalletOrCreateOfferRequest = async () => {
    try {
      if (!selectedOfferId) {
        setIsCreatingRequest(false);
        setCreateRequestError("No offer selected");
        return;
      }

      if (
        !bitcoinAddress ||
        bitcoinAddress.trim().length === 0 ||
        !bitcoinAddressValid
      ) {
        setCreateRequestError("No valid bitcoin address provided");
        return;
      }

      setIsCreatingRequest(true);
      const borrowerNpub = await getNpub();

      let loanType = LoanType.StableCoin;
      switch (selectedProduct) {
        case LoanProductOption.PayWithMoonDebitCard:
          loanType = LoanType.PayWithMoon;
          break;
        case LoanProductOption.StableCoins:
          loanType = LoanType.StableCoin;
          break;
        case LoanProductOption.Fiat:
          loanType = LoanType.Fiat;
          break;
        case LoanProductOption.Bringin:
          loanType = LoanType.Bringin;
          break;
      }

      if (
        loanType === LoanType.StableCoin &&
        (!loanAddress || loanAddress.trim().length === 0)
      ) {
        setCreateRequestError("No address provided");
        return;
      }

      if (loanType === LoanType.Fiat && !encryptedFiatTransferDetails) {
        setCreateRequestError("No bank transfer details provided");
        return;
      }
      if (
        !kycFormDialogConfirmed &&
        Boolean(selectedOffer?.kyc_link && selectedOffer?.kyc_link.length > 0)
      ) {
        setCreateRequestError("KYC form dialog not confirmed");
        return;
      }

      let pk;
      let path;

      if (ownPk && ownPath) {
        pk = ownPk;
        path = ownPath;
      } else {
        const pkAndPath = await getPkAndDerivationPath();

        pk = pkAndPath.pubkey;
        path = pkAndPath.path;
      }

      const res = await postContractRequest({
        id: selectedOfferId,
        loan_amount: selectedLoanAmount,
        duration_days: selectedLoanDuration,
        borrower_btc_address: bitcoinAddress,
        borrower_npub: borrowerNpub,
        borrower_pk: pk,
        borrower_derivation_path: path,
        borrower_loan_address: loanAddress,
        loan_type: loanType,
        moon_card_id: moonCardId,
        fiat_loan_details: encryptedFiatTransferDetails,
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

  const fiatButNoEncryptedDataPresent =
    loanAsset &&
    LoanAssetHelper.isFiat(loanAsset) &&
    !encryptedFiatTransferDetails;
  const kycButNoKycConfirmed = Boolean(
    selectedOffer?.kyc_link &&
      !kycFormDialogConfirmed &&
      selectedOffer.kyc_link.length > 0,
  );

  const bringinButNoKey =
    selectedProduct === LoanProductOption.Bringin && !hasBriningApiKey;

  const buttonDisabled =
    isStillLoading ||
    fiatButNoEncryptedDataPresent ||
    kycButNoKycConfirmed ||
    bringinButNoKey;

  const showStablecoinLoanAddressInput = Boolean(
    selectedOffer?.loan_asset &&
      LoanAssetHelper.isStableCoin(selectedOffer.loan_asset) &&
      selectedProduct !== LoanProductOption.PayWithMoonDebitCard &&
      selectedProduct !== LoanProductOption.Bringin,
  );

  return (
    <Grid
      align={"center"}
      columns={{ initial: "1", md: "2" }}
      gap="3"
      width="auto"
    >
      <Box className="h-full rounded-lg border border-gray-200 p-6">
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
            <DataList.Value className="flex flex-1 justify-end">
              {isStillLoading ? (
                <Skeleton
                  loading={isStillLoading}
                  width={"100px"}
                  height={"20px"}
                ></Skeleton>
              ) : (
                <Lender {...selectedOffer?.lender} showAvatar={false} />
              )}
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
            <DataList.Value className="flex flex-1 justify-end">
              {isStillLoading ? (
                <Skeleton
                  loading={isStillLoading}
                  width={"100px"}
                  height={"20px"}
                ></Skeleton>
              ) : (
                <div className="flex flex-col">
                  {selectedLoanDuration !== ONE_YEAR && (
                    <Flex gap={"2"}>
                      <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold">
                        {(actualInterest * 100).toFixed(2)}%
                      </Text>
                      <Text className="text-font/70 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                        ({(interestRate * 100).toFixed(1)}% p.a.)
                      </Text>
                    </Flex>
                  )}
                  {selectedLoanDuration === ONE_YEAR && (
                    <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold">
                      {(actualInterest * 100).toFixed(2)}% p.a.
                    </Text>
                  )}
                  <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
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
            <DataList.Value className="flex flex-1 justify-end">
              {isStillLoading ? (
                <Skeleton
                  loading={isStillLoading}
                  width={"100px"}
                  height={"20px"}
                ></Skeleton>
              ) : (
                <div className="flex flex-col">
                  <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize">
                    {collateralAmountBtc.toFixed(8)} BTC
                  </Text>
                  <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
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

                {isDiscountedFeeApplied && (
                  <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-start text-[11px]">
                    {-(discountedFee * 100).toFixed(2)}% discount applied
                  </Text>
                )}
              </div>
            </DataList.Label>
            <DataList.Value className="flex flex-1 justify-end">
              {isStillLoading ? (
                <Skeleton
                  loading={isStillLoading}
                  width={"100px"}
                  height={"20px"}
                ></Skeleton>
              ) : (
                <div className="flex flex-col">
                  <Text
                    className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize ${
                      discountedFee === 1 ? "line-through" : ""
                    }`}
                  >
                    {originationFeeBtc.toFixed(8)} BTC
                  </Text>
                  <Text
                    className={`text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px] ${
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
            <DataList.Value className="flex flex-1 justify-end">
              {isStillLoading ? (
                <Skeleton
                  loading={isStillLoading}
                  width={"100px"}
                  height={"20px"}
                ></Skeleton>
              ) : (
                <Text
                  className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize ${
                    discountedFee === 1 ? "line-through" : ""
                  }`}
                >
                  {newFormatCurrency({
                    value: liquidationPrice,
                    maxFraction: 0,
                    minFraction: 1,
                  })}
                </Text>
              )}
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">Coin</DataList.Label>
            <DataList.Value className="flex flex-1 justify-end">
              {isStillLoading ? (
                <Skeleton
                  loading={isStillLoading}
                  width={"100px"}
                  height={"20px"}
                ></Skeleton>
              ) : (
                <Text
                  className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize ${
                    discountedFee === 1 ? "line-through" : ""
                  }`}
                >
                  {loanAsset ? LoanAssetHelper.print(loanAsset) : ""}
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
      <Box className="h-full rounded-lg border border-gray-200 p-6">
        <Flex direction={"column"} gap={"2"}>
          <DataList.Root orientation={"vertical"}>
            <DataList.Item>
              <DataList.Label minWidth="88px">
                <Flex gap={"2"} align={"center"}>
                  Collateral Refund Address
                  <AbbreviationExplanationInfo
                    header={"Collateral Refund Address"}
                    subHeader={""}
                    description={
                      "The Bitcoin address where you want your collateral returned upon loan repayment."
                    }
                  >
                    <RadixLink href="https://faq.lendasat.com" target="_blank">
                      <FaInfoCircle />
                    </RadixLink>
                  </AbbreviationExplanationInfo>
                </Flex>
              </DataList.Label>
              <DataList.Value className="flex flex-1 justify-end">
                {isStillLoading ? (
                  <Skeleton loading={true}>Loading</Skeleton>
                ) : (
                  <Flex direction={"column"} className="w-full">
                    <TextField.Root
                      className="text-font dark:text-font-dark w-full border-0 text-sm font-semibold"
                      size={"3"}
                      type="text"
                      value={bitcoinAddress}
                      onChange={(e) => onBitcoinAddressChange(e.target.value)}
                    >
                      <TextField.Slot className="p-1.5" />
                    </TextField.Root>
                    <Text
                      size={"1"}
                      weight={"light"}
                      className="text-font dark:text-font-dark"
                    >
                      This address will be used to return the collateral to you
                    </Text>
                    {bitcoinAddressInputError && (
                      <span className="text-sm text-red-500">
                        {bitcoinAddressInputError}
                      </span>
                    )}
                  </Flex>
                )}
              </DataList.Value>
            </DataList.Item>

            {loanAsset && LoanAssetHelper.isFiat(loanAsset) && (
              <DataList.Item>
                <DataList.Label minWidth="88px">
                  Loan transfer details
                </DataList.Label>
                <DataList.Value className="flex flex-1">
                  {isStillLoading ? (
                    <Skeleton loading={true}>Loading</Skeleton>
                  ) : (
                    <Box>
                      {fiatTransferDetailsConfirmed ? (
                        <FiatTransferDetails
                          details={fiatTransferDetails}
                          onConfirm={async (
                            encryptFn?: (
                              ownEncryptionPk: string,
                            ) => Promise<FiatLoanDetails>,
                          ) => {
                            if (encryptFn) {
                              const pkAndPath = await getPkAndDerivationPath();
                              const details = await encryptFn(pkAndPath.pubkey);

                              setOwnPk(pkAndPath.pubkey);
                              setOwnPath(pkAndPath.path);

                              setEncryptedFiatTransferDetails(details);
                              setFiatTransferDetailsConfirmed(true);
                            }
                          }}
                          counterpartyPk={selectedOffer.lender_pk}
                          isBorrower={true}
                        />
                      ) : (
                        <FiatTransferDetailsDialog
                          formData={fiatTransferDetails}
                          onConfirm={(data: FiatDialogFormDetails) => {
                            setFiatTransferDetails(data);
                            setFiatTransferDetailsConfirmed(true);
                          }}
                        >
                          <Box width="100%">
                            <Button className={"w-full"}>
                              Add loan transfer details
                            </Button>
                          </Box>
                        </FiatTransferDetailsDialog>
                      )}
                    </Box>
                  )}
                </DataList.Value>
              </DataList.Item>
            )}

            {selectedOffer?.kyc_link && (
              <DataList.Item>
                <DataList.Label minWidth="88px">KYC Required</DataList.Label>
                <DataList.Value className="flex flex-1 justify-end">
                  {isStillLoading ? (
                    <Skeleton loading={true}></Skeleton>
                  ) : (
                    <Flex direction={"column"}>
                      <Callout.Root
                        color={kycFormDialogConfirmed ? "green" : "amber"}
                        className="w-full"
                      >
                        <Callout.Icon>
                          <FontAwesomeIcon
                            icon={
                              kycFormDialogConfirmed ? faCheckCircle : faWarning
                            }
                          />
                        </Callout.Icon>
                        <Callout.Text>
                          <Text>
                            Identity verification is required. Please complete
                            the lender's KYC form. You can continue while the
                            verification is in progress.
                            <br />
                            <KycDialog
                              selectedOffer={selectedOffer}
                              checked={isKycChecked}
                              onCheckedChange={setIsKycChecked}
                              onConfirm={() => setKycFormDialogConfirmed(true)}
                            />
                          </Text>
                        </Callout.Text>
                      </Callout.Root>
                    </Flex>
                  )}
                </DataList.Value>
              </DataList.Item>
            )}

            {selectedProduct === LoanProductOption.PayWithMoonDebitCard && (
              <DataList.Item>
                <DataList.Label minWidth="88px">Choose a card</DataList.Label>
                <DataList.Value className="flex flex-1 justify-end">
                  {moonCardsLoading ? (
                    <Skeleton>Loading</Skeleton>
                  ) : (
                    <MoonCardDropdown
                      cards={moonCards}
                      onSelect={setMoonCardId}
                      loanAmount={selectedLoanAmount}
                    />
                  )}
                </DataList.Value>
              </DataList.Item>
            )}
            {showStablecoinLoanAddressInput && (
              <DataList.Item>
                <DataList.Label minWidth="88px">Loan address</DataList.Label>
                <DataList.Value className="w-full">
                  {isStillLoading || !loanAsset ? (
                    <Skeleton loading={isStillLoading}>Loading</Skeleton>
                  ) : (
                    <Flex direction={"column"} flexGrow={"1"}>
                      <LoanAddressInputField
                        loanAddress={loanAddress ?? ""}
                        setLoanAddress={setLoanAddress}
                        hideButton={hideWalletConnectButton}
                        setHideButton={setHideWalletConnectButton}
                        loanAsset={loanAsset}
                        renderWarning={true}
                      />
                      <Text
                        size={"1"}
                        weight={"light"}
                        className="text-font dark:text-font-dark"
                      >
                        This address will be used to transfer the loan amount
                      </Text>
                    </Flex>
                  )}
                </DataList.Value>
              </DataList.Item>
            )}
          </DataList.Root>
          {bringinButNoKey && (
            <Alert variant={"destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>API Key Required</AlertTitle>
              <AlertDescription>
                You have not connected Lendasat with your Bringin account yet.
                You can do this from{" "}
                <Link
                  to={"/settings/integrations"}
                  className="inline-flex items-center"
                >
                  <em>Settings</em>
                  <ExternalLink className={"w-4 h-4 ml-0.5"} />
                </Link>
              </AlertDescription>
            </Alert>
          )}
          <Button
            className={"w-full"}
            onClick={unlockWalletOrCreateOfferRequest}
            disabled={buttonDisabled}
          >
            {isCreatingRequest ? (
              <>
                <LuLoader className="animate-spin" />
                Please wait
              </>
            ) : (
              "Pick Offer"
            )}
          </Button>
          {createRequestError ? (
            <Box px={"2"} className="md:col-span-2">
              <Callout.Root color="red" className="w-full">
                <Callout.Icon>
                  <FontAwesomeIcon icon={faWarning} />
                </Callout.Icon>
                <Callout.Text>{createRequestError}</Callout.Text>
              </Callout.Root>
            </Box>
          ) : (
            ""
          )}
          <ToS product={selectedProduct} />
        </Flex>
      </Box>
    </Grid>
  );
};
