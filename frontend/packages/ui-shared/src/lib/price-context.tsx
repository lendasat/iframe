import type { ReactNode } from "react";
import type { FC } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Currency } from "./models";

interface PriceContextProps {
  latestPrices: {
    [Currency.USD]: number;
    [Currency.EUR]: number;
  };
}

interface RawPriceUpdate {
  market_price: number;
  currency: Currency;
}

const PriceContext = createContext<PriceContextProps | undefined>(undefined);

type WebSocketConnect = () => void;

const changeProtocolToWSS = (urlString: string): string => {
  try {
    const url = new URL(urlString);
    if (url.protocol === "https:") {
      url.protocol = "wss:";
    } else if (url.protocol === "http:") {
      url.protocol = "ws:";
    }
    return url.toString();
  } catch (e) {
    const error = e instanceof Error ? e.message : e;

    const errorString = error === "" ? "Invalid URL" : `Invalid URL: ${error}.`;

    throw new Error(errorString);
  }
};

export const PriceProvider: FC<{ url: string; children: ReactNode }> = ({
  children,
  url,
}) => {
  const [latestPrices, setLatestPrices] = useState<{
    [Currency.USD]: number;
    [Currency.EUR]: number;
  }>({
    [Currency.USD]: 0,
    [Currency.EUR]: 0,
  });
  const ws = useRef<WebSocket | null>(null);
  const websocketUrl = changeProtocolToWSS(url);

  useEffect(() => {
    const connect: WebSocketConnect = () => {
      let wsUrl: string;
      if (websocketUrl.endsWith("/")) {
        wsUrl = `${websocketUrl}api/pricefeed`;
      } else {
        wsUrl = `${websocketUrl}/api/pricefeed`;
      }

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("Connected to Lendasat price feed WS");
      };

      ws.current.onmessage = (event: MessageEvent) => {
        const data: RawPriceUpdate = JSON.parse(event.data);
        if (data.market_price && data.currency) {
          setLatestPrices((prev) => ({
            ...prev,
            [data.currency]: data.market_price,
          }));
        }
      };

      ws.current.onerror = (e: Event) => {
        console.log(`Got error from price feed: ${JSON.stringify(e)}`);
      };

      ws.current.onclose = () => {
        console.log(
          "Lendasat price feed WS closed, attempting to reconnect...",
        );
        setTimeout(connect, 200);
      };
    };

    if (!ws.current) {
      connect();
    }

    return () => {
      ws.current?.close();
    };
  }, [websocketUrl]);

  return (
    <PriceContext.Provider value={{ latestPrices }}>
      {children}
    </PriceContext.Provider>
  );
};

export const usePriceForCurrency = (currency: Currency): number => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error("usePriceForCurrency must be used within a PriceProvider");
  }
  return context.latestPrices[currency];
};
