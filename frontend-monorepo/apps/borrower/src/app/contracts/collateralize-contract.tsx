import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Heading,
  Separator,
  Text,
  Tooltip as Popup,
} from "@radix-ui/themes";
import QRCode from "qrcode.react";
import queryString from "query-string";
import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";

interface CollateralContractDetailsProps {
  collateral_btc: number;
  totalCollateral: string;
  collateralAddress: string;
  loanOriginatorFeeUsd: string;
  loanOriginatorFee: number;
}

export function CollateralContractDetails({
  collateral_btc,
  totalCollateral,
  collateralAddress,
  loanOriginatorFee,
  loanOriginatorFeeUsd,
}: CollateralContractDetailsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const bip21Url = encodeBip21(collateralAddress, {
    amount: collateral_btc + loanOriginatorFee,
    label: `fund contract`,
  });

  const ellipseAddress = (address: string) => {
    const start = address.slice(0, 10);
    const end = address.slice(-10);
    return `${start}...${end}`;
  };

  const ellipsedAddress = ellipseAddress(collateralAddress);

  return (
    <Box>
      <Heading
        className={"text-font dark:text-font-dark"}
        size={"4"}
        weight={"medium"}
      >
        Fund Collateral Contract
      </Heading>
      <Separator
        className="bg-font/10 dark:bg-font-dark/10"
        size={"4"}
        my={"4"}
      />
      <Box className="space-y-4">
        <Flex align={"center"} justify={"between"}>
          <Text
            size={"2"}
            weight={"medium"}
            className="text-font/70 dark:text-font-dark/70 shrink-0"
          >
            Collateral
          </Text>

          <Text
            size={"2"}
            weight={"medium"}
            className="text-font/70 dark:text-font-dark/70 text-end"
          >
            {collateral_btc.toFixed(8)} BTC
          </Text>
        </Flex>
        <Flex align={"center"} justify={"between"}>
          <Text
            size={"2"}
            weight={"medium"}
            className="text-font/70 dark:text-font-dark/70 shrink-0"
          >
            {/* TODO: here we showed the percentage as well, but we don't know the number :) */}
            Origination fee
          </Text>

          <Popup content={<Text>${loanOriginatorFeeUsd}</Text>} side="top">
            <Text
              size={"2"}
              weight={"medium"}
              className="text-font/70 dark:text-font-dark/70 text-end"
            >
              {loanOriginatorFee.toFixed(8)} BTC
            </Text>
          </Popup>
        </Flex>
        <Separator
          className="bg-font/10 dark:bg-font-dark/10"
          size={"4"}
          my={"4"}
        />
        <Flex align={"center"} justify={"between"}>
          <Text
            size={"2"}
            weight={"bold"}
            className="text-font dark:text-font-dark shrink-0"
          >
            Total
          </Text>

          <Text
            size={"2"}
            weight={"bold"}
            className="text-font dark:text-font-dark text-end"
          >
            {totalCollateral} BTC
          </Text>
        </Flex>
        <Separator
          className="bg-font/10 dark:bg-font-dark/10"
          size={"4"}
          my={"4"}
        />
      </Box>

      <Box py={"4"} className="text-center">
        <Callout.Root color={"blue"}>
          <Callout.Icon>
            <FaInfoCircle size={"18"} />
          </Callout.Icon>
          <Callout.Text>
            Psst! You can send <em>more</em> collateral if you want. The more
            you send, the lower the initial LTV ratio of your contract, and the
            less likely you will ever get liquidated. In any case, you can
            always add more later.
          </Callout.Text>
        </Callout.Root>
      </Box>

      <Box py={"4"} className="text-center">
        <Text
          size={"2"}
          weight={"medium"}
          className="text-font/60 dark:text-font-dark/60"
        >
          Scan QR code to make payment
        </Text>
      </Box>
      <Flex align={"center"} justify={"center"} direction={"column"} gap={"4"}>
        <Box
          onClick={() => handleCopy(bip21Url)}
          p={"5"}
          className="cursor-copy rounded-2xl bg-white hover:shadow-sm"
        >
          <QRCode renderAs={"svg"} value={bip21Url} size={300} />
        </Box>
        <Flex
          align={"center"}
          justify={"center"}
          direction={"column"}
          gap={"3"}
        >
          <Text
            size={"2"}
            className="text-font/60 dark:text-font-dark/60 max-w-sm text-center font-medium"
          >
            Please send <em>at least</em>
            {"  "}
            <Popup content="Copy exact amount to send" side="top">
              <span
                onClick={() => handleCopy(totalCollateral)}
                className="text-font dark:text-font-dark cursor-copy font-semibold"
              >
                {totalCollateral} BTC {"  "}
              </span>
            </Popup>
            to{"  "}
            <br />
            <Button
              onClick={() => handleCopy(collateralAddress)}
              asChild
              variant="ghost"
              className="mt-1 cursor-copy"
            >
              <span className="text-font dark:text-font-dark font-semibold">
                {ellipsedAddress}
              </span>
            </Button>
          </Text>
          <Badge radius="full" color={copied ? "green" : "gray"}>
            <Text size={"1"}>
              {!copied
                ? "Click address/amount to copy"
                : "Copied to clipboard!"}
            </Text>
          </Badge>
        </Flex>
      </Flex>
    </Box>
  );
}

interface EncodeOptions {
  amount: number;
  label: string;
}

function encodeBip21(
  address: string,
  options: EncodeOptions,
  urnScheme = "bitcoin",
): string {
  const scheme = urnScheme;

  if (options.amount !== undefined) {
    if (!Number.isFinite(options.amount)) {
      throw new TypeError("Invalid amount");
    }
    if (options.amount < 0) {
      throw new TypeError("Invalid amount");
    }
  }

  const query = queryString.stringify(options);
  return `${scheme}:${address}${(query ? "?" : "") + query}`;
}
