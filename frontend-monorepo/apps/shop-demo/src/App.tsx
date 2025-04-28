import React, { useState } from 'react';
import { toast } from "sonner"
import { ShopProvider } from './ShopContext';
import Navbar from './NavBar';
import ItemsList from './ItemsList';
import Basket from './Basket';
import Checkout from './Checkout';
import OrderStatus from './OrderStatus';

const App: React.FC = () => {
  const [view, setView] = useState<'shop' | 'checkout' | 'status'>('shop');
  const [orderId, setOrderId] = useState<string | null>(null);

  const navigateTo = (page: string) => {
    setView(page as 'shop' | 'checkout' | 'status');
  };

  const handleOrderCreated = (id: string) => {
    if (id) {
      setOrderId(id);
      setView('status');
      toast("Order Placed!", {
        description: "Your order has been successfully placed.",
      });
    } else {
      setView('shop');
    }
  };

  return (
    <ShopProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar onNavigate={navigateTo} currentView={view} />
        <div className="container mx-auto py-8 px-4">
          {view === 'shop' && <ItemsList />}
          {view === 'checkout' && <Checkout onOrderCreated={handleOrderCreated} />}
          {view === 'status' && <OrderStatus orderId={orderId} />}
          {view === 'shop' && <Basket onCheckout={() => setView('checkout')} />}
        </div>
      </div>
    </ShopProvider>
  );
};

export default App;
