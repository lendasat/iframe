import React from "react";
import { Container } from "react-bootstrap";
import { usePrice } from "./price-context";
import CurrencyFormatter from "./usd";

export function PriceTicker() {
  const { latestPrice } = usePrice();

  return (
    <Container>
      {latestPrice ? <CurrencyFormatter value={latestPrice} currency="USD" locale="en-US" /> : (
        "Loading..."
      )}
    </Container>
  );
}

export default PriceTicker;
