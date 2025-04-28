import React, { useState, useEffect } from 'react';
import { checkOrderStatus } from './apiService';
import { Order } from './types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Truck, Package, AlertCircle } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";

interface OrderStatusProps {
  orderId: string | null;
}

const OrderStatus: React.FC<OrderStatusProps> = ({ orderId }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderStatus = async () => {
    if (!orderId) {
      setError("No order ID found.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const orderData = await checkOrderStatus(orderId);
      setOrder(orderData);
      setError(null);
    } catch (err) {
      console.error('Error fetching order status:', err);
      setError('Failed to load order status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();

    // Set up polling for status updates every 10 seconds
    const intervalId = setInterval(fetchOrderStatus, 10000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [orderId]);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case 'processing':
        return <Package className="h-6 w-6 text-blue-500" />;
      case 'shipped':
        return <Truck className="h-6 w-6 text-purple-500" />;
      case 'delivered':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending':
        return 'Your order is pending confirmation.';
      case 'processing':
        return 'Your order is being processed.';
      case 'shipped':
        return 'Your order has been shipped!';
      case 'delivered':
        return 'Your order has been delivered!';
      case 'cancelled':
        return 'Your order has been cancelled.';
      default:
        return 'Status unknown.';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading order status...</p>
      </div>
    );
  }

  if (error || !orderId) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error || "No order ID found."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!order) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Order Not Found</AlertTitle>
        <AlertDescription>
          We couldn't find an order with ID: {orderId}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Order Status</h2>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Order #{order.id.substring(0, 8)}</CardTitle>
            <Button variant="outline" onClick={fetchOrderStatus} size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <div className="flex items-center">
              {getStatusIcon(order.status)}
              <div className="ml-2">
                <AlertTitle className="capitalize">{order.status}</AlertTitle>
                <AlertDescription>
                  {getStatusText(order.status)}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          <div>
            <h3 className="font-medium text-lg mb-2">Order Summary</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-lg mb-2">Shipping Information</h3>
              <p className="text-sm">{order.customer_name}</p>
              <p className="text-sm">{order.shipping_address.street}</p>
              <p className="text-sm">
                {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
              </p>
              <p className="text-sm">{order.shipping_address.country}</p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">Order Date</h3>
              <p className="text-sm">
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <h3 className="font-medium text-lg mt-4 mb-2">Contact</h3>
              <p className="text-sm">{order.customer_email}</p>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={() => window.location.href = '/'} className="w-full">
            Continue Shopping
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default OrderStatus;
