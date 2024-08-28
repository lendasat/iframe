import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface PriceContextProps {
  latestPrice: number | undefined;
}

const PriceContext = createContext<PriceContextProps | undefined>(undefined);

export const PriceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [latestPrice, setLatestPrice] = useState<number | undefined>();

  useEffect(() => {
    const socket = new WebSocket("wss://ws.coincap.io/prices?assets=bitcoin");

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLatestPrice(data.bitcoin);
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
