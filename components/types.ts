export type Product = {
  id: string;
  sku: string;
  title: string;
  description: string;
  category_path: string[];
  image_urls: string[];
  currency: string;
  price: number;
  compare_at_price?: number;
  inventory_count: number;
  origin_hub: { id: string; name: string; city: string };
  is_flash_sale?: boolean;
  flash_sale_price?: number;
};

export type CartItem = { product: Product; quantity: number };

export type Quote = {
  order_id: string;
  items_total: number;
  customs_fee: number;
  shipping_fee: number;
  vat_fee: number;
  stamp_duty_fee?: number;
  grand_total: number;
  currency: string;
};

export type OrderSummary = {
  id: string;
  currency: string;
  total_amount: number;
  shipping_fee: number;
  customs_fee: number;
  vat_fee: number;
  order_status: string;
  current_tracking_stage: string;
  package_label: string;
  created_at: string;
  item_count: number;
  items_summary: string;
};

export type Review = {
  id: string;
  rating: number;
  review_text: string;
  media_urls: string[];
  created_at: string;
  author: string;
  is_mine: boolean;
};

export type ReviewSummary = { count: number; average_rating: number };

export type Tab = "home" | "cart" | "account" | "track" | "escrow" | "support";
export type AuthMode = "welcome" | "signin" | "signup";
export type AppStage = "booting" | "auth" | "app";

export type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  sender_type: string;
  sender_id: string;
  message: string;
  created_at: string;
};
