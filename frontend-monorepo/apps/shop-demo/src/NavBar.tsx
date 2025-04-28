import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { ShoppingCart, Home } from "lucide-react";
import { useShop } from "./ShopContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Navbar: React.FC = () => {
  const { basket } = useShop();
  const location = useLocation();

  // Calculate total items in the basket
  const itemCount = basket.reduce((count, item) => count + item.quantity, 0);

  return (
    <div className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">LendaShop</h1>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Button
                  variant={location.pathname === "/" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  asChild
                >
                  <Link to="/">
                    <Home size={18} />
                    <span>Shop</span>
                  </Link>
                </Button>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" className="flex items-center gap-2" asChild>
            <Link to="/checkout">
              <ShoppingCart size={18} />
              <span>Cart</span>
              {itemCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {itemCount}
                </Badge>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
