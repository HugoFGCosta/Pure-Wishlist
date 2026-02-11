export interface Shop {
  id: string;
  shop_domain: string;
  access_token: string | null;
  plan: string;
  settings: ShopSettings;
  installed_at: string;
  uninstalled_at: string | null;
  created_at: string;
}

export interface ShopSettings {
  button_color: string;
  button_style: "icon" | "icon_text";
  notify_price_drop: boolean;
  notify_back_in_stock: boolean;
  button_text?: string;
  page_title?: string;
}

export interface WishlistItem {
  id: string;
  shop_id: string;
  customer_id: number;
  product_id: number;
  created_at: string;
}

export interface WishlistEvent {
  id: string;
  shop_id: string;
  customer_id: number;
  product_id: number;
  event_type: "added" | "removed" | "purchased";
  created_at: string;
}

export interface ProductSnapshot {
  id: string;
  shop_id: string;
  product_id: number;
  price: number;
  compare_at_price: number | null;
  inventory_quantity: number;
  captured_at: string;
}

export interface NotificationLogEntry {
  id: string;
  shop_id: string;
  customer_id: number;
  product_id: number;
  type: "price_drop" | "back_in_stock";
  sent_at: string;
}

export interface ProxyRequestBody {
  action: "toggle" | "check" | "list";
  productId?: number;
  productIds?: number[];
}
