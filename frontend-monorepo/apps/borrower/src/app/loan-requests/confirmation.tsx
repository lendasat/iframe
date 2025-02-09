import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useAuth, useBorrowerHttpClient } from "@frontend-monorepo/http-client-borrower";
import {
  formatCurrency,
  getFormatedStringFromDays,
  InterestRateInfoLabel,
  LiquidationPriceInfoLabel,
  LtvInfoLabel,
  newFormatCurrency,
  ONE_YEAR,
  StableCoinHelper,
  usePrice,
} from "@frontend-monorepo/ui-shared";
import { Box, Callout, DataList, Flex, Heading, Skeleton, Text } from "@radix-ui/themes";
import { FaInfoCircle } from "react-icons/fa";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useAsync } from "react-use";
import EmptyResult from "../../assets/search.png";
import { Lender } from "../request-loan/lender";

export type ServiceType = "stable" | "card" | "fiat";

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
  const { getLoanOffer } = useBorrowerHttpClient();
  const { latestPrice } = usePrice();
  const { user } = useAuth();

  if (!selectedProduct || !selectedLoanAmountString || !selectedLoanDurationString) return <EmptyInfoMessage />;

  const selectedLoanAmount = parseInt(selectedLoanAmountString);
  const selectedLoanDuration = parseInt(selectedLoanDurationString);

  const { loading, value: selectedOffer, error } = useAsync(async () => {
    if (!selectedOfferId) {
      return;
    }
    return getLoanOffer(selectedOfferId);
  }, [selectedOfferId]);

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

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <Heading size="4" mb="4" className="text-font dark:text-font-dark">
        Summary to borrow <strong>{formatCurrency(selectedLoanAmount || 0)}</strong> for{" "}
        {getFormatedStringFromDays(selectedLoanDuration)}
      </Heading>
      <DataList.Root>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Lender</DataList.Label>
          <DataList.Value>
            {isStillLoading
              ? <Skeleton loading={true}>Loading</Skeleton>
              : <Lender {...selectedOffer?.lender} showAvatar={false} />}
          </DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">
            <InterestRateInfoLabel>
              <Flex align={"center"} gap={"2"}>
                Interest
                <FaInfoCircle />
              </Flex>
            </InterestRateInfoLabel>
          </DataList.Label>
          <DataList.Value>
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
            <LtvInfoLabel>
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Needed collateral ({(ltv * 100).toFixed(0)}% LTV)
                </Text>
                <FaInfoCircle />
              </Flex>
            </LtvInfoLabel>
          </DataList.Label>
          <DataList.Value>
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
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                Origination fee
                <FaInfoCircle />
              </Flex>

              {isDiscountedFeeApplied
                && (
                  <Text className="text-[11px] text-font/50 dark:text-font-dark/50 mt-0.5 self-start">
                    {-(discountedFee * 100).toFixed(2)}% discount applied
                  </Text>
                )}
            </div>
          </DataList.Label>
          <DataList.Value>
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
            <LiquidationPriceInfoLabel>
              <Flex align={"center"} gap={"2"} className="text-font dark:text-font-dark">
                <Text className="text-xs font-medium text-font/60 dark:text-font-dark/60">
                  Liquidation Price
                </Text>
                <FaInfoCircle />
              </Flex>
            </LiquidationPriceInfoLabel>
          </DataList.Label>
          <DataList.Value>
            <Skeleton loading={isStillLoading}>
              {newFormatCurrency({ value: liquidationPrice, maxFraction: 0, minFraction: 1 })}
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">
            Coin
          </DataList.Label>
          <DataList.Value>
            <Skeleton loading={isStillLoading}>
              {selectedCoin ? StableCoinHelper.print(selectedCoin) : "Loading"}
            </Skeleton>
          </DataList.Value>
        </DataList.Item>
      </DataList.Root>
      {error && (
        <Callout.Root color="tomato">
          <Callout.Icon>
            <IoInformationCircleOutline />
          </Callout.Icon>
          <Callout.Text>
            {error.message}
          </Callout.Text>
        </Callout.Root>
      )}
    </div>
  );
};
