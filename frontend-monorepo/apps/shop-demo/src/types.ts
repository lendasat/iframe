export interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
}

export interface BasketItem extends Item {
  quantity: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderItemRequest {
  item_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: OrderItemRequest[];
  customer_name: string;
  customer_email: string;
  shipping_address: Address;
  billing_address: Address;
}

export enum OrderStatusType {
  Pending = "Pending",
  PaymentProcessing = "PaymentProcessing",
  PaymentProcessed = "PaymentProcessed",
  Shipped = "Shipped",
  Delivered = "Delivered",
  Cancelled = "Cancelled",
}

export interface ErrorResponse {
  OrderNotFound?: boolean;
  ContractNotFound?: boolean;
}

interface OrderItemResponse {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderResponse {
  id: string;
  status: OrderStatusType;
  customer_name: string;
  customer_email: string;
  shipping_address: Address;
  billing_address: Address;
  items: OrderItemResponse[];
  total_price: number;
  created_at: number;
}

export type WsOrderResponse = {
  type: "order";
  data: OrderResponse;
};

export type WsErrorResponse = {
  type: "error";
  data: ErrorResponse;
};
export type WsResponse = WsOrderResponse | WsErrorResponse;
