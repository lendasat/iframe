import React, { useMemo } from "react";
import { OrderStatusType } from "./types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Truck,
  Package,
  AlertCircle,
  DotIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrderWebSocket } from "@/lib/useOrderWebsocketHook.ts";
import { BASE_URL } from "@/lib/apiService.ts";
import { changeProtocolToWSS } from "@/lib/utils.ts";

const OrderStatus: React.FC = () => {
  const [searchParams, _setSearchParams] = useSearchParams();

  const orderId = searchParams.get("orderId");
  const contractId = searchParams.get("contractId");

  const navigate = useNavigate();

  // Use useMemo to create the WebSocket URL to prevent it from changing on re-renders
  const wsUrl = useMemo(() => {
    if (!orderId) return null;

    return `${changeProtocolToWSS(BASE_URL)}api/ws/order-status?order_id=${orderId}&contract_id=${contractId}`;
  }, [orderId, contractId]);

  // Only use the hook if we have a valid orderId and URL
  const { order, isConnected, error, reconnect } =
    orderId && wsUrl
      ? useOrderWebSocket(orderId, {
          url: wsUrl,
          onError: (err) =>
            console.error(`WebSocket error: ${JSON.stringify(err)}.`, err),
          reconnectAttempts: 5,
          reconnectInterval: 3000,
        })
      : { order: null, isConnected: false, error: null, reconnect: () => {} };

  // Early return if no orderId
  if (!orderId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>No order ID defined</AlertDescription>
      </Alert>
    );
  }

  console.log(`Received order details: ${JSON.stringify(order)}`);

  const getStatusIcon = (status?: OrderStatusType) => {
    if (!status) {
      return <AlertCircle className="h-6 w-6" />;
    }

    switch (status) {
      case "Pending":
        return <AlertCircle className="h-6 w-6" />;
      case "PaymentProcessing":
        return <Package className="h-6 w-6" />;
      case "PaymentProcessed":
        return <Package className="h-6 w-6" />;
      case "Shipped":
        return <Truck className="h-6 w-6" />;
      case "Delivered":
        return <CheckCircle className="h-6 w-6" />;
      case "Cancelled":
        return <AlertCircle className="h-6 w-6" />;
      default:
        return <AlertCircle className="h-6 w-6" />;
    }
  };

  const getStatusText = (status?: OrderStatusType) => {
    if (!status) {
      return "Unknown status";
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
      default:
        return "Unknown status";
    }
  };

  const getStatusTitle = (status?: OrderStatusType) => {
    if (!status) {
      return "Unknown";
    }
    switch (status) {
      case "Pending":
        return "Pending";
      case "PaymentProcessing":
        return "Payment processing";
      case "PaymentProcessed":
        return "Payment processed";
      case "Shipped":
        return "Shipped";
      case "Delivered":
        return "Delivered";
      case "Cancelled":
        return "Cancelled";
      default:
        return "Unknown status";
    }
  };

  // Error state - after orderId check
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" onClick={reconnect} className="mt-2">
          Try Again
        </Button>
      </Alert>
    );
  }

  // Loading state - we have a connection but no order yet
  if (!order && isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert>
          <AlertTitle>Connecting to order status...</AlertTitle>
          <AlertDescription>
            Please wait while we retrieve your order information.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Not found state - we've connected but no order data was found
  if (!order && !isConnected) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Order Not Found</AlertTitle>
        <AlertDescription>
          We couldn't find an order with ID: {orderId}
        </AlertDescription>
        <Button variant="outline" onClick={reconnect} className="mt-2">
          Try Again
        </Button>
      </Alert>
    );
  }

  // We have order data, render the order details
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Order Status</h2>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              Order #{order?.id ? order.id.substring(0, 8) : "Unknown"}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isConnected && (
                <span className="text-sm text-red-500">Disconnected</span>
              )}
              <Button variant="outline" onClick={reconnect} size="sm">
                Refresh{" "}
                <DotIcon
                  className={`w-5 h-5 ${isConnected ? "text-green-500" : "text-red-500"}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            {getStatusIcon(order?.status)}
            <AlertTitle className="capitalize">
              {getStatusTitle(order?.status)}
            </AlertTitle>
            <AlertDescription>{getStatusText(order?.status)}</AlertDescription>
          </Alert>

          {order?.items && order.items.length > 0 && (
            <div>
              <h3 className="font-medium text-lg mb-2">Order Summary</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id || item.name}
                    className="flex justify-between"
                  >
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
          )}

          {order?.shipping_address && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-lg mb-2">
                  Shipping Information
                </h3>
                <p className="text-sm">{order.customer_name}</p>
                <p className="text-sm">{order.shipping_address.street}</p>
                <p className="text-sm">
                  {order.shipping_address.city}, {order.shipping_address.state}{" "}
                  {order.shipping_address.postal_code}
                </p>
                <p className="text-sm">{order.shipping_address.country}</p>
              </div>

              <div>
                <h3 className="font-medium text-lg mb-2">Order Date</h3>
                <p className="text-sm">
                  {order.created_at &&
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
                <p className="text-sm">{order.customer_email}</p>
              </div>
            </div>
          )}
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
