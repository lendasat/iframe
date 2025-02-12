import { Button, Select } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { MdOutlineClear } from "react-icons/md";

// Enum and Helper Class
export enum StableCoin {
  USDT_SN = "USDT_SN",
  USDC_SN = "USDC_SN",
  USDT_POL = "USDT_POL",
  USDC_POL = "USDC_POL",
  USDT_ETH = "USDT_ETH",
  USDC_ETH = "USDC_ETH",
  USDC_SOL = "USDC_SOL",
  USDT_SOL = "USDT_SOL",
}

export function parseStableCoin(value: string): StableCoin | undefined {
  if (Object.values(StableCoin).includes(value as StableCoin)) {
    return value as StableCoin;
  }
  return undefined;
}

export class StableCoinHelper {
  static print(coin: StableCoin): string {
    switch (coin) {
      case StableCoin.USDT_SN:
        return "USDT Starknet";
      case StableCoin.USDC_SN:
        return "USDC Starknet";
      case StableCoin.USDT_POL:
        return "USDT Polygon";
      case StableCoin.USDC_POL:
        return "USDC Polygon";
      case StableCoin.USDT_ETH:
        return "USDT Ethereum";
      case StableCoin.USDC_ETH:
        return "USDC Ethereum";
      case StableCoin.USDC_SOL:
        return "USDT Solana";
      case StableCoin.USDT_SOL:
        return "USDC Solana";
    }
  }

  static toChain(stableCoin: StableCoin) {
    switch (stableCoin) {
      case StableCoin.USDC_SN:
      case StableCoin.USDT_SN:
        return "Starknet";
      case StableCoin.USDC_POL:
      case StableCoin.USDT_POL:
        return "Polygon";
      case StableCoin.USDC_ETH:
      case StableCoin.USDT_ETH:
        return "Ethereum";
      case StableCoin.USDT_SOL:
      case StableCoin.USDC_SOL:
        return "Solana";
    }
  }

  static toContractUrl(stableCoin: StableCoin) {
    switch (stableCoin) {
      case StableCoin.USDC_SN:
        return "https://starkscan.co/token/0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
      case StableCoin.USDT_SN:
        return "https://starkscan.co/token/0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8";
      case StableCoin.USDC_POL:
        return "https://polygonscan.com/token/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
      case StableCoin.USDT_POL:
        return "https://polygonscan.com/token/0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
      case StableCoin.USDC_ETH:
        return "https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
      case StableCoin.USDT_ETH:
        return "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7";
      case StableCoin.USDC_SOL:
        return "https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      case StableCoin.USDT_SOL:
        return "https://solscan.io/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    }
  }

  static all(): StableCoin[] {
    return [
      StableCoin.USDT_SN,
      StableCoin.USDC_SN,
      StableCoin.USDT_ETH,
      StableCoin.USDC_ETH,
      StableCoin.USDT_POL,
      StableCoin.USDC_POL,
      StableCoin.USDT_SOL,
      StableCoin.USDC_SOL,
    ];
  }

  static mapFromBackend(chain: string, asset: string): StableCoin {
    if (chain === "Ethereum") {
      if (asset === "Usdc") {
        return StableCoin.USDC_ETH;
      } else if (asset === "Usdt") {
        return StableCoin.USDT_ETH;
      }
    } else if (chain === "Starknet") {
      if (asset === "Usdc") {
        return StableCoin.USDC_SN;
      } else if (asset === "Usdt") {
        return StableCoin.USDT_SN;
      }
    } else if (chain === "Polygon") {
      if (asset === "Usdc") {
        return StableCoin.USDC_POL;
      } else if (asset === "Usdt") {
        return StableCoin.USDT_POL;
      }
    } else if (chain === "Solana") {
      if (asset === "Usdc") {
        return StableCoin.USDC_SOL;
      } else if (asset === "Usdt") {
        return StableCoin.USDT_SOL;
      }
    }
    throw Error("Invalid chain or network provided");
  }
}

// Dropdown Component
export function StableCoinDropdown({
  onSelect,
  coins,
  filter,
  disabled,
  defaultCoin,
}: {
  onSelect: (coin?: StableCoin) => void;
  coins: StableCoin[];
  filter?: boolean;
  disabled?: boolean;
  defaultCoin?: StableCoin; // Optional prop for default selected coin
}) {
  // Initialize selectedCoin with defaultCoin if provided, otherwise fall back to StableCoin.USDT_SN
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | "disabled">(
    defaultCoin ?? "disabled",
  );

  // Reseting choosen coin
  useEffect(() => {
    if (!filter) {
      setSelectedCoin(defaultCoin ?? "disabled");
    }
  }, [filter, defaultCoin]);

  const handleChange = (value: string) => {
    const selectedValue = parseStableCoin(value);
    setSelectedCoin(selectedValue ?? "disabled");
    onSelect(selectedValue);
  };

  const handleClear = () => {
    setSelectedCoin("disabled");
    onSelect(undefined);
  };

  return (
    <div className="flex items-center space-x-2 max-w-full">
      <div className="w-full">
        <Select.Root
          value={selectedCoin}
          onValueChange={handleChange}
          defaultValue={"disabled"}
          disabled={disabled}
        >
          <Select.Trigger
            variant={"surface"}
            className="shadow-none focus-visible:outline-none p-3 outline-none h-10 text-font dark:text-font-dark text-sm border rounded-lg w-full max-w-full dark:bg-dark-700"
          />

          <Select.Content
            highContrast
            color="purple"
            className="font-normal text-sm z-50"
          >
            <Select.Item value="disabled">-- Select a coin --</Select.Item>
            {coins.map((coin: StableCoin) => (
              <Select.Item key={coin} value={coin}>
                {StableCoinHelper.print(coin)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
      <Button
        variant="outline"
        onClick={handleClear}
        aria-label="Clear selection"
        className="flex-shrink-0 text-font dark:text-font-dark"
      >
        <MdOutlineClear size={"16px"} />
      </Button>
    </div>
  );
}
