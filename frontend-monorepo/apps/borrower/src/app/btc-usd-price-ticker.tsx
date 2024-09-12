import { CurrencyFormatter } from "@frontend-monorepo/ui-shared";
import React from "react";
import { Container } from "react-bootstrap";
import { usePrice } from "./price-context";

export function PriceTicker() {
  const { latestPrice } = usePrice();

  return (
    <Container>
      {latestPrice ? <CurrencyFormatter value={latestPrice} /> : (
        "Loading..."
      )}
    </Container>
  );
}

export default PriceTicker;
