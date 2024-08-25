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
}

// Dropdown Component
export function StableCoinDropdown({ onSelect }) {
  const [selectedCoin, setSelectedCoin] = useState<StableCoin>(StableCoin.USDT_SN);

  const handleChange = (coin: StableCoin) => {
    setSelectedCoin(coin);
    onSelect(coin);
  };

  return (
    <Form.Select
      value={StableCoinHelper.print(selectedCoin)}
      onChange={handleChange}
    >
      <option value="">
        -- Filter a coin --
      </option>
      {Object.values(StableCoin).map((coin: StableCoin) => (
        <option key={coin} value={coin}>
          {StableCoinHelper.print(coin)}
        </option>
      ))}
    </Form.Select>
  );
}
