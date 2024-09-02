import React, { useState } from "react";
import { Form } from "react-bootstrap";

// Enum and Helper Class
export enum StableCoin {
  USDT_SN = "USDT_SN",
  USDC_SN = "USDC_SN",
  USDT_ETH = "USDT_ETH",
  USDC_ETH = "USDC_ETH",
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
  defaultCoin?: StableCoin; // Optional prop for default selected coin
}) {
  // Initialize selectedCoin with defaultCoin if provided, otherwise fall back to StableCoin.USDT_SN
  const [selectedCoin, setSelectedCoin] = useState<StableCoin>(defaultCoin | "");

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value as StableCoin;
    setSelectedCoin(selectedValue);
    onSelect(selectedValue);
  };

  if (coins.length === 1) {
    return (
      <Form.Select value={selectedCoin} onChange={handleChange}>
        <option key={coins[0]} value={coins[0]}>
          {StableCoinHelper.print(coins[0])}
        </option>
      </Form.Select>
    );
  } else {
    return (
      <Form.Select value={selectedCoin} onChange={handleChange}>
        <option value="" disabled={!filter}>-- Filter a coin --</option>
        {coins.map((coin: StableCoin) => (
          <option key={coin} value={coin}>
            {StableCoinHelper.print(coin)}
          </option>
        ))}
      </Form.Select>
    );
  }
}
