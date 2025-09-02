import { calculateCollateralUsdValue } from "./calculate-collateral-usd-value";

export const calculateLtv = (
  outstandingBalance?: number,
  latestPrice?: number,
  collateralSats?: number,
) => {
  let collateralUsdValue = calculateCollateralUsdValue(
    collateralSats,
    latestPrice,
  );

  if (
    !outstandingBalance ||
    !latestPrice ||
    !collateralSats ||
    !collateralUsdValue
  ) {
    return undefined;
  }

  return outstandingBalance / collateralUsdValue;
};
