export type Product = {
  id: string;
  sku: string;
  title: string;
  description: string;
  category_path: string[];
  image_urls: string[];
  currency: string;
  price: number;
  updated_at?: string;
  catalog_version?: number;
  delivery_fee?: number;
  compare_at_price?: number;
  inventory_count: number;
  origin_hub: { id: string; name: string; city: string };
  is_flash_sale?: boolean;
  flash_sale_price?: number;
  review_count: number;
  sold_count: number;
  average_rating: number;
  provider_id?: string;
  fulfillment_mode?: "merchant_local" | "merchant_cross_border";
  inventory_country_code?: string;
  inventory_city?: string;
  inventory_location?: string;
  stock_state?: "locally_available" | "foreign_stock" | "import_on_demand";
  handling_time_hours?: number;
  delivery_min_days?: number;
  distance_km?: number;
  delivery_max_days?: number;
  delivery_methods?: string[];
  delivery_areas?: { country_code: string; state?: string; city?: string; delivered_price?: number; delivery_fee?: number; currency_code?: string }[];
};

export type CartItem = { product: Product; quantity: number };

export type Quote = {
  order_id: string;
  country_code?: string;
  delivery_address?: { address: string; city: string; state: string; postal_code: string; country_code: string };
  items_total: number;
  customs_fee: number;
  shipping_fee: number;
  vat_fee: number;
  stamp_duty_fee?: number;
  platform_fee: number;
  platform_fee_before_xp?: number;
  xp_discount?: number;
  xp_available?: number;
  xp_eligible?: number;
  xp_redemption_enabled?: boolean;
  grand_total: number;
  currency: string;
  customer_pays_gateway_fee?: boolean;
  gateway_fee_note?: string;
};

export type OrderSummary = {
  id: string;
  currency: string;
  total_amount: number;
  shipping_fee: number;
  customs_fee: number;
  vat_fee: number;
  platform_fee: number;
  order_status: string;
  current_tracking_stage: string;
  package_label: string;
  created_at: string;
  item_count: number;
  items_summary: string;
  seller_funds?: { status: "pending" | "on_hold" | "settled" | "failed" | "reversed" };
  fulfillment?: {
    route: "merchant_local" | "merchant_cross_border";
    owner: "merchant";
    status: string;
    carrier: string;
    tracking_number: string;
    tracking_url: string;
    current_location: string;
    estimated_delivery_at?: string | null;
    version: number;
  };
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

export type Tab = "home" | "services" | "cart" | "account" | "track" | "support";
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
  id?: string;
  sender_type: string;
  sender_id: string;
  message: string;
  created_at: string;
};
