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

  const handleChange = (value: string) => {
    const selectedValue = value as StableCoin;
    setSelectedCoin(selectedValue);
    onSelect(selectedValue);
  };

  if (coins.length === 1) {
    return (
      // <Form.Select
      //   className="outline-none focus:shadow-none focus:border-font text-sm font-medium"
      //   value={selectedCoin} onValueChange={handleChange}>
      //   <option key={coins[0]} value={coins[0]}>
      //     {StableCoinHelper.print(coins[0])}
      //   </option>
      // </Form.Select>
      <Select.Root
        value={selectedCoin}
        onValueChange={handleChange}
      >
        <Select.Trigger
          variant={"ghost"}
          className="shadow-none focus-visible:outline-none outline-none h-8 font-medium w-auto border rounded "
        />
        <Select.Content highContrast color="purple" className="font-medium">
          <Select.Item key={coins[0]} value={coins[0]}>
            {StableCoinHelper.print(coins[0])}
          </Select.Item>
        </Select.Content>
      </Select.Root>
    );
  } else {
    return (
      // <Form.Select
      //   className="outline-none focus:shadow-none focus:border-font text-sm font-medium"
      //   value={selectedCoin} onChange={handleChange}>
      //   <option value="" disabled={!filter}>-- Select a coin --</option>
      //   {coins.map((coin: StableCoin) => (
      //     <option

      //       key={coin} value={coin}>
      //       {StableCoinHelper.print(coin)}
      //     </option>
      //   ))}
      // </Form.Select>
      <Select.Root
        value={selectedCoin}
        onValueChange={handleChange}
        defaultValue="select"
      >
        <Select.Trigger
          variant={"surface"}
          className="shadow-none focus-visible:outline-none outline-none h-10 font-medium border rounded "
        />

        <Select.Content highContrast color="purple" className="font-medium">
          <Select.Item value="select">-- Select a coin --</Select.Item>
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
