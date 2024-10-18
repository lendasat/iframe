import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

interface PriceContextProps {
  latestPrice: number;
}

interface RawPriceUpdate {
  market_price: number;
}

const PriceContext = createContext<PriceContextProps | undefined>(undefined);

type WebSocketConnect = () => void;

export const PriceProvider: React.FC<{ url: string; children: ReactNode }> = ({ children, url }) => {
  const [latestPrice, setLatestPrice] = useState<number | undefined>();
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect: WebSocketConnect = () => {
      let wsUrl;
      if (url.endsWith("/")) {
        wsUrl = `${url}api/pricefeed`;
      } else {
        wsUrl = `${url}/api/pricefeed`;
      }

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("Connected to Lendasat price feed WS");
      };

      ws.current.onmessage = (event: MessageEvent) => {
        const data: RawPriceUpdate = JSON.parse(event.data);
        if (data.market_price) {
          setLatestPrice(data.market_price);
        }
      };

      ws.current.onerror = (e: Event) => {
        console.log(`Got error from price feed: ${JSON.stringify(e)}`);
      };

      ws.current.onclose = () => {
        console.log("Lendasat price feed WS closed, attempting to reconnect...");
        setTimeout(connect, 200);
      };
    };

    if (!ws.current) {
      connect();
    }

    return () => {
      ws.current?.close();
    };
  }, [url]);

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
