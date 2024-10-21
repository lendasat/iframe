import { Button, Select } from "@radix-ui/themes";
import React, { useState } from "react";
import { MdOutlineClear } from "react-icons/md";

// Enum and Helper Class
export enum StableCoin {
  USDT_SN = "USDT_SN",
  USDC_SN = "USDC_SN",
  USDT_POL = "USDT_POL",
  USDC_POL = "USDC_POL",
  USDT_ETH = "USDT_ETH",
  USDC_ETH = "USDC_ETH",
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
    ];
  }

  static mapFromBackend(chain: string, asset: string): StableCoin | undefined {
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
    }
    return undefined;
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
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | "disabled">(defaultCoin ?? "disabled");

  // Reseting choosen coin
  React.useEffect(() => {
    if (!filter) {
      setSelectedCoin(defaultCoin ?? "disabled");
    }
  });

  const handleChange = (value: string) => {
    const selectedValue = parseStableCoin(value);
    setSelectedCoin(selectedValue ?? "disabled");
    onSelect(selectedValue);
  };

  const handleClear = () => {
    setSelectedCoin("disabled");
    onSelect(undefined);
  };

  if (coins.length === 1) {
    return (
      <div className="flex items-center space-x-2 max-w-full">
        <div className="w-full">
          <Select.Root
            value={selectedCoin}
            onValueChange={handleChange}
          >
            <Select.Trigger
              variant="surface"
              className="shadow-none focus-visible:outline-none p-3 outline-none h-8 font-normal text-sm w-auto border z-50 rounded-lg"
            />
            <Select.Content highContrast color="purple" className="font-normal text-sm">
              <Select.Item key={coins[0]} value={coins[0]}>
                {StableCoinHelper.print(coins[0])}
              </Select.Item>
              {/* Add more Select.Item components for other coins if needed */}
            </Select.Content>
          </Select.Root>

          <Button
            variant="outline"
            onClick={handleClear}
            aria-label="Clear selection"
            type={"button"}
          >
            <MdOutlineClear size={"16px"} />
          </Button>
        </div>
      </div>
    );
  } else {
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
              className="shadow-none focus-visible:outline-none p-3 outline-none h-10 font-normal text-sm border rounded-lg w-full max-w-full"
            />

            <Select.Content highContrast color="purple" className="font-normal text-sm z-50">
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
          className="flex-shrink-0"
        >
          <MdOutlineClear size={"16px"} />
        </Button>
      </div>
    );
  }
}
