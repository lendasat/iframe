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
import { Skeleton } from "@/components/ui/skeleton";

const ItemsList: React.FC = () => {
  const { items, loading, error, addToBasket } = useShop();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {[...Array(8)].map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="aspect-square w-full">
              <Skeleton className="h-full w-full" />
            </div>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button variant="outline">Retry</Button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-center py-8">No items available.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold">Our Products</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden flex flex-col">
            <div className="aspect-square w-full overflow-hidden">
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </div>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-gray-500">{item.description}</p>
              <p className="mt-2 text-lg font-semibold">
                ${item.price.toFixed(2)}
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => addToBasket(item)}>
                Add to Cart
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ItemsList;
