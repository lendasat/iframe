import axios from "axios";
import { Item, CreateOrderRequest, Order } from "../types.ts";

export const BASE_URL = "http://localhost:3211";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchItems = async (): Promise<Item[]> => {
  const response = await api.get<Item[]>("/api/items");
  return response.data;
};

export const createOrder = async (
  orderData: CreateOrderRequest,
): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>("/api/orders", orderData);
  return response.data;
};

export const checkOrderStatus = async (orderId: string): Promise<Order> => {
  const response = await api.get<Order>(`/api/orders/${orderId}`);
  return response.data;
};

export const getImageUrl = (path: string): string => {
  // this is useful if we want to map to use cloudflare in production
  const url = `http://localhost:3211${path}`;
  return url;
};
