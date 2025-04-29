import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ShopProvider } from "./ShopContext";
import Navbar from "./NavBar";
import ItemsList from "./ItemsList";
import Basket from "./Basket";
import Checkout from "./Checkout";
import OrderStatus from "./OrderStatus";

const App: React.FC = () => {
  return (
    <ShopProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="py-8 px-8">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                      <ItemsList />
                    </div>
                    <div className="md:col-span-1">
                      <Basket />
                    </div>
                  </div>
                }
              />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order/:orderId" element={<OrderStatus />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </Router>
    </ShopProvider>
  );
};

export default App;
