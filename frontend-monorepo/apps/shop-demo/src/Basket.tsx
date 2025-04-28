import React from "react";
import { useShop } from "./ShopContext";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Basket: React.FC = () => {
  const { basket, removeFromBasket, updateQuantity, getBasketTotal } =
    useShop();
  const navigate = useNavigate();


  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Your Cart</CardTitle>
        </CardHeader>
        <CardContent>
          {basket.map((item) => (
            <div
              key={item.id}
              className="flex py-4 border-b last:border-b-0"
            >
              <div className="ml-4 flex-grow flex flex-col">
                {/* Top: Item name and price */}
                <div className="mb-4">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-gray-500">
                    ${item.price.toFixed(2)}
                  </p>
                </div>

                {/* Quantity controls moved below the price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus size={16} />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      className="h-8 w-16 text-center"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          updateQuantity(item.id, val);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => removeFromBasket(item.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div>
            <p className="text-lg font-bold">
              Total: ${getBasketTotal().toFixed(2)}
            </p>
          </div>
          <Button onClick={() => navigate("/checkout")} disabled={basket.length === 0}>
            Proceed to Checkout
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Basket;
