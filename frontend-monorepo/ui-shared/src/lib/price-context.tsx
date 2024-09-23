import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface PriceContextProps {
  latestPrice: number;
}

interface RawPriceUpdate {
  market_price: number;
}

const PriceContext = createContext<PriceContextProps | undefined>(undefined);

export const PriceProvider: React.FC<{ url: string; children: ReactNode }> = ({ children, url }) => {
  const [latestPrice, setLatestPrice] = useState<number | undefined>();

  useEffect(() => {
    const socket = new WebSocket(`${url}/api/pricefeed`);

    socket.onmessage = (event) => {
      const data: RawPriceUpdate = JSON.parse(event.data);
      if (data.market_price) {
        setLatestPrice(data.market_price);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <PriceContext.Provider value={{ latestPrice }}>
      {children}
    </PriceContext.Provider>
  );
};

export const usePrice = () => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error("usePrice must be used within a PriceProvider");
  }
  return context;
};
