import { Select } from "@radix-ui/themes";
import React, { useState } from "react";

// Enum and Helper Class
export enum StableCoin {
  USDT_SN = "USDT_SN",
  USDC_SN = "USDC_SN",
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
      case StableCoin.USDT_ETH:
        return "USDT Ethereum";
      case StableCoin.USDC_ETH:
        return "USDC Ethereum";
    }
  }

  static all(): StableCoin[] {
    return [
      StableCoin.USDT_SN,
      StableCoin.USDC_SN,
      StableCoin.USDT_ETH,
      StableCoin.USDC_ETH,
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
    }
    return undefined;
  }
}

// Dropdown Component
export function StableCoinDropdown({
  onSelect,
  coins,
  filter,
  defaultCoin,
}: {
  onSelect: (coin: StableCoin) => void;
  coins: StableCoin[];
  filter: boolean;
  defaultCoin?: StableCoin; // Optional prop for default selected coin 
}) {
  // Initialize selectedCoin with defaultCoin if provided, otherwise fall back to StableCoin.USDT_SN
  const [selectedCoin, setSelectedCoin] = useState<StableCoin | undefined>(defaultCoin);

  // Reseting choosen coin
  React.useEffect(() => {
    if (!filter) {
      setSelectedCoin(defaultCoin)
    }
  })

  const handleChange = (value: string) => {
    const selectedValue = value as StableCoin;
    setSelectedCoin(selectedValue);
    onSelect(selectedValue);
  };

  if (coins.length === 1) {
    return (
      <Select.Root
        value={selectedCoin}
        onValueChange={handleChange}
      >
        <Select.Trigger
          variant={"surface"}
          className="shadow-none focus-visible:outline-none p-3 outline-none h-8 font-normal text-sm w-auto border z-50 rounded-lg"
        />
        <Select.Content highContrast color="purple" className="font-normal text-sm">
          <Select.Item key={coins[0]} value={coins[0]}>
            {StableCoinHelper.print(coins[0])}
          </Select.Item>
        </Select.Content>
      </Select.Root>
    );
  } else {
    return (
      <Select.Root
        value={selectedCoin == undefined ? 'disabled' : selectedCoin}
        onValueChange={handleChange}
        defaultValue={"disabled"}
      >
        <Select.Trigger
          variant={"surface"}
          className="shadow-none focus-visible:outline-none p-3 outline-none h-10 font-normal text-sm border rounded-lg w-full"
        />

        <Select.Content highContrast color="purple" className="font-normal text-sm z-50">
          <Select.Item value="disabled" disabled>-- Select a coin --</Select.Item>
          {coins.map((coin: StableCoin) => (
            <Select.Item key={coin} value={coin}>
              {StableCoinHelper.print(coin)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    );
  }
}
