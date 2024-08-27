import React, { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import CurrencyFormatter from "./usd";

interface Price {
  bitcoin: number;
}

export function PriceTicker() {
  const [latestPrice, setLatestPrice] = useState<number | undefined>();

  useEffect(() => {
    const socket = new WebSocket("wss://ws.coincap.io/prices?assets=bitcoin");

    socket.onmessage = (event) => {
      const data: Price = JSON.parse(event.data);
      setLatestPrice(data.bitcoin);
    };

    // Clean up on component unmount
    return () => {
      socket.close();
    };
  }, []);

  return (
    <Container>
      {latestPrice ? <CurrencyFormatter value={latestPrice} currency="USD" locale="en-US" /> : "Loading..."}
    </Container>
  );
}

export default PriceTicker;
