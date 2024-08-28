import React from "react";
import PriceTicker from "./btc-usd-price-ticker";

export interface Price {
  bitcoin: number;
}

function DashBoard() {
  return (
    <>
      Here comes everythings
      <PriceTicker />
    </>
  );
}

export default DashBoard;
