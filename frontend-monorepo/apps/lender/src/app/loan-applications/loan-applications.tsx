import {
  Box,
  Button,
  Callout,
  DataList,
  Flex,
  Grid,
  Heading,
  ScrollArea,
  Skeleton,
  Text,
} from "@radix-ui/themes";
import { Form } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWarning } from "@fortawesome/free-solid-svg-icons";
import {
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LoanAddressInputField,
  LoanAsset,
  LoanAssetHelper,
  newFormatCurrency,
  ONE_YEAR,
} from "@frontend/ui-shared";
import { useNavigate, useParams } from "react-router-dom";
import { useAsync } from "react-use";
import { useWallet } from "@frontend/browser-wallet";
import {
  LoanApplicationStatus,
  useLenderHttpClient,
} from "@frontend/http-client-lender";
import { useState } from "react";
import { addDays } from "date-fns";
import AddFiatDetailsDialog from "./add-fiat-details-dialog";
import { FiatLoanDetails } from "@frontend/base-http-client";

export default function TakeLoanApplication() {
  const navigate = useNavigate();
  const { getNpub, getPkAndDerivationPath } = useWallet();
  const { id } = useParams();

  const { getLoanApplication, takeLoanApplication } = useLenderHttpClient();
  const [isTaking, setIsTaking] = useState(false);
  const [error, setError] = useState("");
  const [loanAddress, setLoanAddress] = useState("");
  const [hideWalletConnectButton, setHideWalletConnectButton] = useState(false);

  const {
    value: loanApplication,
    loading: loanAplicationLoading,
    error: loadingApplicationError,
  } = useAsync(async () => {
    if (id) {
      return getLoanApplication(id);
    }
    return undefined;
  }, [id]);

  const {
    value: lenderPubkey,
    loading: lenderPkLoading,
    error: lenderPkError,
  } = useAsync(async () => {
    return await getPkAndDerivationPath();
  });

  if (lenderPkError) {
    console.error(`Couldn't get pubkey ${lenderPkError}`);
  }

  const loading = lenderPkLoading || loanAplicationLoading;

  const interestRate = loanApplication?.interest_rate;

  const actualInterest =
    loanApplication &&
    (loanApplication.interest_rate / ONE_YEAR) * loanApplication.duration_days;

  const actualInterestUsdAmount =
    loanApplication &&
    actualInterest &&
    loanApplication.loan_amount * actualInterest;

  const liquidationPrice = loanApplication?.liquidation_price; // share this from the backend

  const expiry =
    loanApplication && addDays(new Date(), loanApplication.duration_days);

  const onSubmit = async (encryptedFiatLoanDetails?: FiatLoanDetails) => {
    try {
      if (!id) {
        setError("No loan application selected");
        return;
      }

      if (!lenderPubkey) {
        setError("No pubkey set");
        return;
      }

      setIsTaking(true);
      const lenderNpub = await getNpub();

      if (
        !encryptedFiatLoanDetails &&
        (!loanAddress || loanAddress.trim().length === 0)
      ) {
        setError("No payout details provided");
        return;
      }

      const contractId = await takeLoanApplication(id, {
        lender_npub: lenderNpub,
        lender_pk: lenderPubkey.pubkey,
        lender_derivation_path: lenderPubkey.path,
        loan_repayment_address: loanAddress,
        fiat_loan_details: encryptedFiatLoanDetails,
      });
      //
      if (contractId !== undefined) {
        // TODO: once we can edit, we should jump right to the newly created application
        navigate(`/my-contracts/${contractId}`);
      } else {
        setError("Failed at taking loan application.");
      }
    } catch (error) {
      console.log(`Unexpected error happened ${error}`);
      setError(`${error}`);
    } finally {
      setIsTaking(false);
    }
  };

  const buttonDisabled =
    loanApplication?.status !== LoanApplicationStatus.Available;

  const isFiatLoanApplication =
    (loanApplication && LoanAssetHelper.isFiat(loanApplication?.loan_asset)) ||
    false;

  console.log(`isFiatLoanApplication ${isFiatLoanApplication}`);
  console.log(`lenderPubkey ${lenderPubkey}`);

  return (
    <ScrollArea type="always" scrollbars="vertical">
      <Form className="space-y-4 p-4">
        <Grid
          align={"center"}
          columns={{ initial: "1", md: "2" }}
          gap="3"
          width="auto"
        >
          <Box className="h-full rounded-lg border border-gray-200 p-6">
            <Heading size="4" mb="4" className="text-font dark:text-font-dark">
              <Flex gap={"2"}>
                <Text>You will lend</Text>
                <Text>
                  <strong>
                    <Skeleton loading={loading} width={"100px"} height={"20px"}>
                      {loanApplication &&
                        formatCurrency(loanApplication.loan_amount)}
                    </Skeleton>
                  </strong>
                </Text>
                <Text>for</Text>
                <Text>
                  <Skeleton loading={loading} width={"100px"} height={"20px"}>
                    {loanApplication &&
                      getFormatedStringFromDays(loanApplication.duration_days)}
                  </Skeleton>
                </Text>
              </Flex>
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
                    {loanApplication?.duration_days !== ONE_YEAR && (
                      <Skeleton
                        loading={loading}
                        width={"100px"}
                        height={"20px"}
                      >
                        <Flex gap={"2"}>
                          <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold">
                            {actualInterest &&
                              (actualInterest * 100).toFixed(2)}
                            %
                          </Text>
                          <Text className="text-font/70 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                            ({interestRate && (interestRate * 100).toFixed(1)}%
                            p.a.)
                          </Text>
                        </Flex>
                      </Skeleton>
                    )}
                    {loanApplication?.duration_days === ONE_YEAR && (
                      <Text className="text-font/70 dark:text-font-dark/70 text-[13px] font-semibold">
                        <Skeleton loading={loading}>
                          {actualInterest && (actualInterest * 100).toFixed(2)}%
                        </Skeleton>
                        p.a.
                      </Text>
                    )}
                    <Text className="text-font/50 dark:text-font-dark/50 mt-0.5 self-end text-[11px]">
                      ≈{" "}
                      <Skeleton
                        loading={loading}
                        width={"100px"}
                        height={"20px"}
                      >
                        {actualInterestUsdAmount &&
                          formatCurrency(actualInterestUsdAmount, 1, 1)}{" "}
                      </Skeleton>
                      in total
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
                    className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold`}
                  >
                    <Skeleton loading={loading} width={"100px"} height={"20px"}>
                      {liquidationPrice &&
                        newFormatCurrency({
                          value: liquidationPrice,
                          maxFraction: 0,
                          minFraction: 1,
                        })}
                    </Skeleton>
                  </Text>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="88px">
                  <Flex align={"center"} gap={"2"}>
                    Expiry Date
                  </Flex>
                </DataList.Label>
                <DataList.Value className="flex flex-1 justify-end">
                  <Text
                    className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold`}
                  >
                    <Skeleton loading={loading} width={"100px"} height={"20px"}>
                      {expiry?.toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Skeleton>
                  </Text>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="88px">Coin</DataList.Label>
                <DataList.Value className="flex flex-1 justify-end">
                  <Text
                    className={`text-font/70 dark:text-font-dark/70 text-[13px] font-semibold`}
                  >
                    <Skeleton loading={loading}>
                      {loanApplication &&
                        LoanAssetHelper.print(loanApplication.loan_asset)}
                    </Skeleton>
                  </Text>
                </DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Box>
          <Box className="h-full rounded-lg border border-gray-200 p-6">
            <Flex direction={"column"} gap={"2"}>
              {!isFiatLoanApplication && (
                <DataList.Root orientation={"vertical"}>
                  <DataList.Item>
                    <DataList.Label minWidth="88px">
                      Loan address
                    </DataList.Label>
                    <DataList.Value className="w-full">
                      <Flex direction={"column"} flexGrow={"1"}>
                        <LoanAddressInputField
                          loanAddress={loanAddress ?? ""}
                          setLoanAddress={setLoanAddress}
                          hideButton={hideWalletConnectButton}
                          setHideButton={setHideWalletConnectButton}
                          loanAsset={
                            loanApplication?.loan_asset || LoanAsset.USDC_POL
                          }
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
                </DataList.Root>
              )}
              {loanApplication && isFiatLoanApplication && lenderPubkey && (
                <AddFiatDetailsDialog
                  borrowerPk={loanApplication?.borrower_pk}
                  lenderPk={lenderPubkey.pubkey}
                  onComplete={async (data) => {
                    await onSubmit(data);
                  }}
                >
                  <Button
                    size={"3"}
                    type={"button"}
                    loading={isTaking}
                    disabled={buttonDisabled}
                  >
                    Take loan application
                  </Button>
                </AddFiatDetailsDialog>
              )}
              {!isFiatLoanApplication && (
                <Button
                  size={"3"}
                  onClick={async (e) => {
                    e.preventDefault();
                    await onSubmit();
                  }}
                  loading={isTaking}
                  disabled={buttonDisabled}
                >
                  Take loan application
                </Button>
              )}
              {(error || loadingApplicationError) && (
                <Box px={"2"} className="md:col-span-2">
                  <Callout.Root color="red" className="w-full">
                    <Callout.Icon>
                      <FontAwesomeIcon icon={faWarning} />
                    </Callout.Icon>
                    <Callout.Text>
                      {error || loadingApplicationError?.message || ""}
                    </Callout.Text>
                  </Callout.Root>
                </Box>
              )}
            </Flex>
          </Box>
        </Grid>
      </Form>
    </ScrollArea>
  );
}
