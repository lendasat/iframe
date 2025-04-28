import React, { useState, useEffect } from "react";
import { checkOrderStatus } from "./apiService";
import { Order, OrderStatusType } from "./types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Truck, Package, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useParams, useNavigate } from "react-router-dom";

const OrderStatus: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
      console.error("Error fetching order status:", err);
      setError("Failed to load order status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();

    // Set up polling for status updates every 30 seconds
    const intervalId = setInterval(fetchOrderStatus, 30000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [orderId]);

  const getStatusIcon = (status?: OrderStatusType) => {
    if (!status) {
      return "Unknown";
    }

    switch (status) {
      case "Pending":
        return <AlertCircle className="h-6 w-6 " />;
      case "PaymentProcessing":
        return <Package className="h-6 w-6 " />;
      case "PaymentProcessed":
        return <Package className="h-6 w-6 " />;
      case "Shipped":
        return <Truck className="h-6 w-6 " />;
      case "Delivered":
        return <CheckCircle className="h-6 w-6 " />;
      case "Cancelled":
        return <AlertCircle className="h-6 w-6 " />;
    }
  };

  const getStatusText = (status?: OrderStatusType) => {
    if (!status) {
      return "Unknown";
    }
    switch (status) {
      case "Pending":
        return "Your order is pending confirmation.";
      case "PaymentProcessing":
        return "Your payment is being processed.";
      case "PaymentProcessed":
        return "Your payment has been processed.";
      case "Shipped":
        return "Your order has been shipped!";
      case "Delivered":
        return "Your order has been delivered!";
      case "Cancelled":
        return "Your order has been cancelled.";
    }
  };

  if (error || !orderId) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error || "No order ID found."}</AlertDescription>
      </Alert>
    );
  }

  if (order === undefined && !loading) {
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
            <CardTitle>Order #{order?.id.substring(0, 8)}</CardTitle>
            <Button variant="outline" onClick={fetchOrderStatus} size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            {getStatusIcon(order?.status)}
            <AlertTitle className="capitalize">{order?.status}</AlertTitle>
            <AlertDescription>{getStatusText(order?.status)}</AlertDescription>
          </Alert>

          <div>
            <h3 className="font-medium text-lg mb-2">Order Summary</h3>
            <div className="space-y-2">
              {order?.items.map((item) => (
                <div key={item.name} className="flex justify-between">
                  {item.quantity}x {item.name}
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${order?.total_price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-lg mb-2">Shipping Information</h3>
              <p className="text-sm">{order?.customer_name}</p>
              <p className="text-sm">{order?.shipping_address.street}</p>
              <p className="text-sm">
                {order?.shipping_address.city}, {order?.shipping_address.state}{" "}
                {order?.shipping_address.postal_code}
              </p>
              <p className="text-sm">{order?.shipping_address.country}</p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">Order Date</h3>
              <p className="text-sm">
                {order &&
                  new Date(order.created_at * 1000).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
              </p>
              <h3 className="font-medium text-lg mt-4 mb-2">Contact</h3>
              <p className="text-sm">{order?.customer_email}</p>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={() => navigate("/")} className="w-full">
            Continue Shopping
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default OrderStatus;
