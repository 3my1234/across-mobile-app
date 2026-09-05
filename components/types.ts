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
  review_count: number;
  average_rating: number;
  provider_id?: string;
  fulfillment_mode?: "atlantic_import" | "merchant_local" | "merchant_cross_border";
  inventory_country_code?: string;
  inventory_city?: string;
  inventory_location?: string;
  stock_state?: "locally_available" | "foreign_stock" | "import_on_demand";
  handling_time_hours?: number;
  delivery_min_days?: number;
  delivery_max_days?: number;
  delivery_methods?: string[];
  atlantic_last_mile?: boolean;
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
  fulfillment?: {
    route: "atlantic_import" | "merchant_local" | "merchant_cross_border";
    owner: "atlantic" | "merchant" | "atlantic_last_mile";
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
  sender_type: string;
  sender_id: string;
  message: string;
  created_at: string;
};
