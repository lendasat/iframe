import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LoanProductOption } from "@frontend/http-client-borrower";
import { useWallet } from "@frontend/browser-wallet";
import {
  LoanType,
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  AbbreviationExplanationInfo,
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  LtvInfoLabel,
  newFormatCurrency,
  ONE_YEAR,
  usePrice,
} from "@frontend/ui-shared";
import {
  Box,
  Button,
  Callout,
  DataList,
  Flex,
  Grid,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Link as RadixLink } from "@radix-ui/themes/dist/cjs/components/link";
import { Network, validate } from "bitcoin-address-validation";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { ToS } from "../loan-offers/tos";

interface ConfirmationProps {
  selectedAssetType: LoanAsset;
  selectedLoanAmount: string;
  selectedLoanDuration: string;
  selectedInterestRate: string;
  originationFee: number;
}

export const Confirmation = ({
  selectedAssetType,
  selectedLoanAmount: selectedLoanAmountString,
  selectedLoanDuration: selectedLoanDurationString,
  selectedInterestRate,
  originationFee,
}: ConfirmationProps) => {
  const navigate = useNavigate();
  const { getNpub, getPkAndDerivationPath } = useWallet();

  const { postLoanApplication } = useHttpClientBorrower();
  const { latestPrice } = usePrice();
  const { user } = useAuth();
  const [bitcoinAddressInputError, setBitcoinAddressInputError] = useState("");
  const [bitcoinAddressValid, setBitcoinAddressValid] = useState(false);
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [loanAddress, setLoanAddress] = useState("");
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);
  // TODO: set this value
  const [createRequestError, setCreateRequestError] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  useState(false);

  const selectedLoanAmount = parseInt(selectedLoanAmountString || "0");
  const selectedLoanDuration = parseInt(selectedLoanDurationString || "0");

  const ltv = 0.5; // TODO: in the future we might want to allow the user to configure this
  const interestRate = Number.parseFloat(selectedInterestRate);
  const actualInterest = interestRate / (ONE_YEAR / selectedLoanDuration);
  const actualInterestUsdAmount = (selectedLoanAmount * actualInterest) / 100.0;
  const collateralAmountBtc = selectedLoanAmount / latestPrice / ltv;
  const collateralUsdAmount = selectedLoanAmount / ltv;

  const discountedFee = user?.first_time_discount_rate || 0.0;
  const isDiscountedFeeApplied = discountedFee ? discountedFee > 0 : false;

  const discountedOriginationFee =
    originationFee - originationFee * discountedFee;
  const originationFeeBtc = collateralAmountBtc * discountedOriginationFee;
  const originationFeeUsd = selectedLoanAmount * discountedOriginationFee;

  const liquidationPrice = (selectedLoanAmount / collateralAmountBtc) * 0.95;

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
      if (
        !bitcoinAddress ||
        bitcoinAddress.trim().length === 0 ||
        !bitcoinAddressValid
      ) {
        setCreateRequestError("Invalid bitcoin refund address provided");
        return;
      }

      setIsCreatingRequest(true);
      const borrowerNpub = await getNpub();
      const borrowerPk = await getPkAndDerivationPath();

      if (
        LoanAssetHelper.isStableCoin(selectedAssetType) &&
        (!loanAddress || loanAddress.trim().length === 0)
      ) {
        setCreateRequestError("No loan address provided");
        return;
      }

      if (LoanAssetHelper.isFiat(selectedAssetType)) {
        setCreateRequestError(
          "Fiat loan requests are not supported at this stage",
        );
        return;
      }

      const res = await postLoanApplication({
        ltv,
        loan_amount: selectedLoanAmount,
        duration_days: selectedLoanDuration,
        borrower_npub: borrowerNpub,
        borrower_pk: borrowerPk.pubkey,
        borrower_derivation_path: borrowerPk.path,
        loan_asset: selectedAssetType,
        loan_type: LoanType.StableCoin,
        interest_rate: interestRate / 100.0,
        borrower_loan_address: loanAddress,
        borrower_btc_address: bitcoinAddress,
      });
      //
      if (res !== undefined) {
        // TODO: once we can edit, we should jump right to the newly created application
        navigate(`/loan-applications`);
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

  const buttonDisabled =
    selectedAssetType && LoanAssetHelper.isFiat(selectedAssetType);

  const showStablecoinLoadAddressInput = Boolean(
    selectedAssetType && LoanAssetHelper.isStableCoin(selectedAssetType),
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
          <strong>{formatCurrency(selectedLoanAmount || 0)}</strong> for{" "}
          {getFormatedStringFromDays(selectedLoanDuration)}
        </Heading>
        <DataList.Root>
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
              <div className="flex flex-col">
                {selectedLoanDuration !== ONE_YEAR && (
                  <Flex gap={"2"}>
                    <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold">
                      {actualInterest.toFixed(2)}%
                    </Text>
                    <Text className="text-font/70 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                      ({interestRate.toFixed(1)}% p.a.)
                    </Text>
                  </Flex>
                )}
                {selectedLoanDuration === ONE_YEAR && (
                  <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold">
                    {actualInterest.toFixed(2)}% p.a.
                  </Text>
                )}
                <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                  ≈ {formatCurrency(actualInterestUsdAmount, 1, 1)} in total
                </Text>
              </div>
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
              <div className="flex flex-col">
                <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize">
                  {collateralAmountBtc.toFixed(8)} BTC
                </Text>
                <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                  ≈ {formatCurrency(collateralUsdAmount)}
                </Text>
              </div>
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
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="88px">Coin</DataList.Label>
            <DataList.Value className="flex flex-1 justify-end">
              <Text
                className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold capitalize ${
                  discountedFee === 1 ? "line-through" : ""
                }`}
              >
                {selectedAssetType
                  ? LoanAssetHelper.print(selectedAssetType)
                  : ""}
              </Text>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
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
              </DataList.Value>
            </DataList.Item>

            {showStablecoinLoadAddressInput && (
              <DataList.Item>
                <DataList.Label minWidth="88px">Loan address</DataList.Label>
                <DataList.Value className="w-full">
                  <Flex direction={"column"} flexGrow={"1"}>
                    <LoanAddressInputField
                      loanAddress={loanAddress ?? ""}
                      setLoanAddress={setLoanAddress}
                      hideButton={hideWalletConnectButton}
                      setHideButton={setHideWalletConnectButton}
                      loanAsset={selectedAssetType}
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
                </DataList.Value>
              </DataList.Item>
            )}
          </DataList.Root>
          <Button
            size={"3"}
            onClick={async (e) => {
              e.preventDefault();
              await unlockWalletOrCreateOfferRequest();
            }}
            loading={isCreatingRequest}
            disabled={buttonDisabled}
          >
            Submit loan request
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
          {/*// TODO: we probably want to support the actual integration as well such as PayWithMoon, for now, we support only StableCoins*/}
          <ToS product={LoanProductOption.StableCoins} />
        </Flex>
      </Box>
    </Grid>
  );
};
