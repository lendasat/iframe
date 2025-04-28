import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Item, BasketItem } from "./types";
import { fetchItems } from "./apiService";

interface ShopContextType {
  items: Item[];
  basket: BasketItem[];
  loading: boolean;
  error: string | null;
  addToBasket: (item: Item) => void;
  removeFromBasket: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearBasket: () => void;
  getBasketTotal: () => number;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const useShop = (): ShopContextType => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
};

interface ShopProviderProps {
  children: ReactNode;
}

export const ShopProvider: React.FC<ShopProviderProps> = ({ children }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = async () => {
      try {
        setLoading(true);
        const data = await fetchItems();
        setItems(data);
      } catch (err) {
        setError("Failed to load items. Please try again later.");
        console.error("Error fetching items:", err);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, []);

  const addToBasket = (item: Item) => {
    setBasket((prevBasket) => {
      const existingItemIndex = prevBasket.findIndex((i) => i.id === item.id);

      if (existingItemIndex >= 0) {
        const updatedBasket = [...prevBasket];
        updatedBasket[existingItemIndex] = {
          ...updatedBasket[existingItemIndex],
          quantity: updatedBasket[existingItemIndex].quantity + 1,
        };
        return updatedBasket;
      } else {
        return [...prevBasket, { ...item, quantity: 1 }];
      }
    });
  };

  const removeFromBasket = (itemId: string) => {
    setBasket((prevBasket) => prevBasket.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromBasket(itemId);
      return;
    }

    setBasket((prevBasket) =>
      prevBasket.map((item) =>
        item.id === itemId ? { ...item, quantity } : item,
      ),
    );
  };

  const clearBasket = () => {
    setBasket([]);
  };

  const getBasketTotal = () => {
    return basket.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
  };

  const value = {
    items,
    basket,
    loading,
    error,
    addToBasket,
    removeFromBasket,
    updateQuantity,
    clearBasket,
    getBasketTotal,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};
