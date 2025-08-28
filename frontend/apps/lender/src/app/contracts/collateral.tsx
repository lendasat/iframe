import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleX,
  LuClipboard,
  LuExternalLink,
  LuTriangleAlert,
} from "react-icons/lu";
import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Separator,
  Skeleton,
} from "@frontend/shadcn";
import { Contract, LiquidationStatus } from "@frontend/http-client-lender";
import {
  formatCurrency,
  formatSatsToBitcoin,
  LoanAssetHelper,
  usePriceForCurrency,
} from "@frontend/ui-shared";

const shortenAddress = (address?: string) => {
  if (!address) {
    return undefined;
  }

  const firstSix = address.slice(0, 6);
  const lastFour = address.slice(-4);

  return `${firstSix}...${lastFour}`;
};

interface CollateralProps {
  contract?: undefined | Contract;
}

interface LtvHealthInfoProps {
  contract?: Contract;
  funded: boolean;
}

function LtvHealthInfo({ contract, funded }: LtvHealthInfoProps) {
  if (contract === undefined) {
    return (
      <div className="flex items-start rounded-md border border-gray-200 bg-gray-50 p-4">
        <Skeleton className="mx-4 h-5 w-5 rounded-full" />
        <div>
          <Skeleton className="mb-2 h-6 w-[150px]" />
          <Skeleton className="h-4 w-[450px]" />
        </div>
      </div>
    );
  }

  const liquidationStatus = contract.liquidation_status;

  if (!funded) {
    return (
      <div className="flex items-start rounded-md border border-gray-200 bg-gray-50 p-4">
        <LuCircleAlert className="mr-2 mt-0.5 h-5 w-5 text-gray-500" />
        <div>
          <p className="text-sm font-medium text-gray-800">Unfunded Contract</p>
          <p className="text-sm text-gray-600">
            Your contract is not funded yet and hence does not have a LTV ratio.
          </p>
        </div>
      </div>
    );
  }

  if (liquidationStatus === LiquidationStatus.Healthy) {
    return (
      <div className="flex items-start rounded-md border border-green-200 bg-green-50 p-4">
        <LuCircleCheck className="mr-2 mt-0.5 h-5 w-5 text-green-500" />
        <div>
          <p className="text-sm font-medium text-green-800">
            Healthy Collateral Ratio
          </p>
          <p className="text-sm text-green-600">
            Your current LTV is well below the liquidation threshold.
          </p>
        </div>
      </div>
    );
  }

  if (liquidationStatus === LiquidationStatus.FirstMarginCall) {
    return (
      <div className="flex items-start rounded-md border border-yellow-200 bg-yellow-50 p-4">
        <LuTriangleAlert className="mr-2 mt-0.5 h-5 w-5 text-yellow-500" />
        <div>
          <p className="text-sm font-medium text-yellow-800">
            Warning: Approaching Margin Call
          </p>
          <p className="text-sm text-yellow-600">
            Your LTV has exceeded the first margin call threshold. Consider
            adding more collateral.
          </p>
        </div>
      </div>
    );
  }
  if (liquidationStatus === LiquidationStatus.SecondMarginCall) {
    return (
      <div className="flex items-start rounded-md border border-orange-200 bg-orange-50 p-4">
        <LuCircleAlert className="mr-2 mt-0.5 h-5 w-5 text-orange-500" />
        <div>
          <p className="text-sm font-medium text-orange-800">
            Urgent: Second Margin Call
          </p>
          <p className="text-sm text-orange-600">
            Your LTV has exceeded the second margin call threshold. Add more
            collateral immediately to avoid liquidation.
          </p>
        </div>
      </div>
    );
  }

  if (liquidationStatus === LiquidationStatus.Liquidated) {
    return (
      <div className="flex items-start rounded-md border border-red-200 bg-red-50 p-4">
        <LuCircleX className="mr-2 mt-0.5 h-5 w-5 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-800">
            Collateral Liquidated
          </p>
          <p className="text-sm text-red-600">
            Your collateral has been liquidated due to an unsafe LTV ratio.
          </p>
        </div>
      </div>
    );
  }
}

export const Collateral = ({ contract }: CollateralProps) => {
  const latestPrice = usePriceForCurrency(
    LoanAssetHelper.toCurrency(contract?.loan_asset),
  );

  const [contractAddressCopied, setContractAddressCopied] = useState(false);

  const contractAddress = contract?.contract_address;
  const collateralAmount = formatSatsToBitcoin(contract?.collateral_sats);
  const collateralAmountFiat =
    contract?.collateral_sats != null && latestPrice
      ? contract.collateral_sats === 0
        ? formatCurrency(0, LoanAssetHelper.toCurrency(contract.loan_asset))
        : formatCurrency(
            (contract.collateral_sats / 100000000) * latestPrice,
            LoanAssetHelper.toCurrency(contract.loan_asset),
          )
      : undefined;

  const collateralBtc = contract?.collateral_sats
    ? contract.collateral_sats / 100000000
    : undefined;

  // to calculate the ltv we need to subtract the origination fee from the deposited collateral
  const collateralBtcMinusOriginationFee = contract
    ? (contract.collateral_sats - contract.origination_fee_sats) / 100000000
    : undefined;
  const ltvRatio =
    collateralBtcMinusOriginationFee &&
    latestPrice &&
    contract?.balance_outstanding
      ? (contract.balance_outstanding /
          (collateralBtcMinusOriginationFee * latestPrice)) *
        100
      : undefined;

  const isFunded = collateralBtc !== undefined && collateralBtc > 0;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContractAddressCopied(true);
      setTimeout(() => setContractAddressCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // TODO: we shouldn't hardcode these values but get them from the backend
  const firstMarginCallThreshold = 70;
  const secondMarginCallThreshold = 80;
  const liquidationThreshold = 90;

  let ltvRatioStop = {
    percent: 100,
    color: "bg-gray-300",
    textcolor: `text-gray-500`,
  };

  if (ltvRatio && ltvRatio > liquidationThreshold) {
    ltvRatioStop = {
      percent: ltvRatio,
      color: `bg-red-500`,
      textcolor: `text-red-500`,
    };
  } else if (ltvRatio && ltvRatio > secondMarginCallThreshold) {
    ltvRatioStop = {
      percent: ltvRatio,
      color: "bg-orange-500",
      textcolor: `text-orange-500`,
    };
  } else if (ltvRatio && ltvRatio > firstMarginCallThreshold) {
    ltvRatioStop = {
      percent: ltvRatio,
      color: "bg-yellow-500",
      textcolor: `text-yellow-500`,
    };
  } else if (ltvRatio && ltvRatio < firstMarginCallThreshold) {
    ltvRatioStop = {
      percent: ltvRatio,
      color: "bg-green-500",
      textcolor: `text-green-500`,
    };
  }

  const depositAddress = contract?.contract_address;
  const mempoolLinkToAddress = `${import.meta.env.VITE_MEMPOOL_REST_URL}/address/${depositAddress}`;

  return (
    <Card className={"border-none shadow-none"}>
      <CardContent className="pt-2">
        <div className="mb-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <span>Current Collateral</span>
            <span className="font-mono">{collateralAmount} BTC</span>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {LoanAssetHelper.toCurrency(contract?.loan_asset).toUpperCase()}
              {" value"}
            </span>
            <span className="font-medium">{collateralAmountFiat}</span>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Contract Address</span>
            <div className="flex items-center">
              {contractAddress ? (
                <p className="font-medium">{shortenAddress(contractAddress)}</p>
              ) : (
                <Skeleton className="h-4 w-[150px]" />
              )}

              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-6 w-6"
                onClick={() => handleCopy(contractAddress || "")}
              >
                {contractAddressCopied ? (
                  <LuCircleCheck className="h-4 w-4" />
                ) : (
                  <LuClipboard className="h-4 w-4" />
                )}
              </Button>
              <Button
                asChild
                size={"icon"}
                variant={"ghost"}
                className="ml-1 h-6 w-6"
              >
                <a
                  href={mempoolLinkToAddress}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <LuExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Liquidation Price</span>
            <div className="flex items-center">
              {contractAddress ? (
                <p className="font-medium">
                  {formatCurrency(
                    contract?.liquidation_price,
                    LoanAssetHelper.toCurrency(contract?.loan_asset),
                  )}
                </p>
              ) : (
                <Skeleton className="h-4 w-[150px]" />
              )}
            </div>
          </div>
        </div>

        <div className="mb-11 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Loan-to-Value (LTV) Ratio</p>
            {ltvRatio ? (
              <p className={`font-bold ${ltvRatioStop.textcolor} `}>
                {ltvRatio.toFixed(2)}%
              </p>
            ) : (
              <Skeleton className="h-6 w-[150px]" />
            )}
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="flex h-full w-full">
              <div
                className={`${ltvRatioStop.color} h-full`}
                style={{ width: ltvRatioStop.percent + "%" }}
              />
            </div>

            {/* 70% threshold tick */}
            <div
              className="absolute top-0 h-4 w-0.5 bg-gray-600"
              style={{ left: `${firstMarginCallThreshold}%` }}
            />

            {/* 80% threshold tick */}
            <div
              className="absolute top-0 h-4 w-0.5 bg-gray-600"
              style={{ left: `${secondMarginCallThreshold}%` }}
            />

            {/* 90% threshold tick */}
            <div
              className="absolute top-0 h-4 w-0.5 bg-gray-600"
              style={{ left: `${liquidationThreshold}%` }}
            />

            {/* Current LTV marker */}
            <div
              className="absolute top-0 h-full w-1 rounded-full bg-black"
              style={{
                left: `${Math.min(ltvRatio || 0, 100)}%`,
                display: ltvRatio ? "block" : "none",
              }}
            ></div>
          </div>
          <div className="mb relative w-full pt-1">
            <span className="absolute left-0 text-xs text-gray-500">0%</span>
            <span
              className={`absolute left-[35%] -translate-x-1/2 text-xs text-green-600`}
            >
              Healthy
            </span>
            <span
              className={`absolute left-[70%] -translate-x-1/2 text-center text-xs text-yellow-600`}
            >
              {firstMarginCallThreshold}%
              <br />
              <span className="hidden sm:inline">Warning</span>
            </span>
            <span
              className={`absolute left-[80%] -translate-x-1/2 text-center text-xs text-orange-600`}
            >
              {secondMarginCallThreshold}% <br />
              <span className="hidden sm:inline">Margin Call</span>
            </span>
            <span
              className={`absolute left-[90%] -translate-x-1/2 text-center text-xs text-red-600`}
            >
              {liquidationThreshold}% <br />
              <span className="hidden sm:inline">Liquidation</span>
            </span>
          </div>
        </div>

        <LtvHealthInfo contract={contract} funded={isFunded} />
      </CardContent>
    </Card>
  );
};
