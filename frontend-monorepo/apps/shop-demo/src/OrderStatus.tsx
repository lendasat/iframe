import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BASE_URL } from "@/lib/apiService.ts";
import {
  ErrorResponse,
  OrderResponse,
  OrderStatusType,
  WsResponse,
} from "./types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  AlertCircle,
  CheckCircle,
  DotIcon,
  Package,
  Truck,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Separator } from "./components/ui/separator";

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
      return "Your payment has been processed. We will ship your order shortly.";
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

// Utility function to change the protocol to wss
const changeProtocolToWSS = (url: string): string => {
  return url.replace(/^http(s?):\/\//i, "ws$1://");
};

const OrderStatusComponent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId: string | null = searchParams.get("orderId");
  const contractId: string | null = searchParams.get("contractId");
  const [orderStatus, setOrderStatus] = useState<OrderResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<ErrorResponse | null>(null);
  const [_websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const websocketUrl: () => string = useCallback(() => {
    return `${changeProtocolToWSS(BASE_URL ?? "")}/api/ws/order-status?order_id=${orderId}&contract_id=${contractId}`;
  }, [orderId, contractId]);

  useEffect(() => {
    if (!orderId || !contractId) {
      console.warn("Order ID or Contract ID not found in search parameters.");
      return;
    }

    const ws: WebSocket = new WebSocket(websocketUrl());
    setWebsocket(ws);

    ws.onopen = (): void => {
      console.log("WebSocket connection opened");
      setIsConnected(true);
    };

    ws.onmessage = (event: MessageEvent): void => {
      try {
        const message: WsResponse = JSON.parse(event.data as string);
        console.log("WebSocket message received:", message);

        if (message.type === "order") {
          setOrderStatus(message.data);
          setErrorMessage(null);
        } else if (message.type === "error") {
          setErrorMessage(message.data);
          setOrderStatus(null);
        }
      } catch (error: any) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = (): void => {
      console.log("WebSocket connection closed");
      setWebsocket(null);
      setIsConnected(false);
      // Optionally attempt to reconnect after a delay
      setTimeout(() => {
        setWebsocket(new WebSocket(websocketUrl()));
      }, 5000);
    };

    ws.onerror = (error: Event): void => {
      console.error("WebSocket error:", error);
      setErrorMessage({
        ConnectionError: true,
      });
    };

    // Cleanup function to close the WebSocket connection when the component unmounts
    return (): void => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [orderId, contractId, websocketUrl]);

  if (errorMessage?.ConnectionError) {
    return <p>Could not connect websocket. Please check logs</p>;
  }

  if (errorMessage?.OrderNotFound) {
    return <p>Order not found.</p>;
  }

  if (errorMessage?.ContractNotFound) {
    return <p>Contract not found.</p>;
  }

  if (orderStatus) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Order Status</h2>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Order #{orderId?.substring(0, 8)}</CardTitle>
              <div className="flex items-center gap-2">
                {!isConnected && (
                  <span className="text-sm text-red-500">Disconnected</span>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate(0);
                  }}
                  size="sm"
                >
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
              {getStatusIcon(orderStatus?.status)}
              <AlertTitle className="capitalize">
                {getStatusTitle(orderStatus?.status)}
              </AlertTitle>
              <AlertDescription>
                {getStatusText(orderStatus?.status)}
              </AlertDescription>
            </Alert>

            {orderStatus?.items && orderStatus.items.length > 0 && (
              <div>
                <h3 className="font-medium text-lg mb-2">Order Summary</h3>
                <div className="space-y-2">
                  {orderStatus.items.map((item) => (
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
                    <span>${orderStatus?.total_price.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {orderStatus?.shipping_address && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-lg mb-2">
                    Shipping Information
                  </h3>
                  <p className="text-sm">{orderStatus.customer_name}</p>
                  <p className="text-sm">
                    {orderStatus.shipping_address.street}
                  </p>
                  <p className="text-sm">
                    {orderStatus.shipping_address.city},{" "}
                    {orderStatus.shipping_address.state}{" "}
                    {orderStatus.shipping_address.postal_code}
                  </p>
                  <p className="text-sm">
                    {orderStatus.shipping_address.country}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-lg mb-2">Order Date</h3>
                  <p className="text-sm">
                    {orderStatus.created_at &&
                      new Date(
                        orderStatus.created_at * 1000,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                  </p>
                  <h3 className="font-medium text-lg mt-4 mb-2">Contact</h3>
                  <p className="text-sm">{orderStatus.customer_email}</p>
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
  }

  return <p>Loading order status...</p>;
};

export default OrderStatusComponent;
