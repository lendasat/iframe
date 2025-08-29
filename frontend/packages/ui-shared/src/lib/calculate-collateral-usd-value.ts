export const calculateCollateralUsdValue = (
  collateralSats?: number,
  latestPrice?: number,
): number | undefined => {
  if (!collateralSats || !latestPrice) {
    return undefined;
  }

  return (collateralSats / 100000000) * latestPrice;
};
