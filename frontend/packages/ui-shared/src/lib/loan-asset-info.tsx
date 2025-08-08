import { LoanAsset, LoanAssetHelper } from "./models";

export const LoanAssetDescription = ({ asset }: { asset: LoanAsset }) => {
  const chain = LoanAssetHelper.toChain(asset);
  const coin = LoanAssetHelper.toCoin(asset);
  const contractUrl = LoanAssetHelper.toContractUrl(asset);
  const isFiat = LoanAssetHelper.isFiat(asset);

  if (isFiat) {
    const fiatDescriptions: Record<LoanAsset, string> = {
      [LoanAsset.USD]: "United States Dollar (USD) - Fiat currency",
      [LoanAsset.EUR]: "Euro (EUR) - Fiat currency",
      [LoanAsset.CHF]: "Swiss Franc (CHF) - Fiat currency",
      [LoanAsset.MXN]: "Mexican Peso (MXN) - Fiat currency",
    };
    return <>{fiatDescriptions[asset] || `${coin} - Fiat currency`}</>;
  }

  // For USDT on Liquid, we need the blockstream URL
  const liquidAssetUrl =
    "https://blockstream.info/liquid/asset/ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2";
  const actualUrl =
    asset === LoanAsset.USDT_Liquid ? liquidAssetUrl : contractUrl;
  const linkLabel =
    asset === LoanAsset.USDT_Liquid ? "View asset" : "View contract";

  return (
    <>
      {`${coin} on ${chain}`}
      {actualUrl && (
        <>
          {". "}
          <a
            href={actualUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {linkLabel}
          </a>
        </>
      )}
    </>
  );
};
