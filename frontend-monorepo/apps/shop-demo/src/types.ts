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

export interface Order {
  id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: BasketItem[];
  customer_name: string;
  customer_email: string;
  shipping_address: Address;
  billing_address: Address;
  total: number;
  created_at: string;
}
