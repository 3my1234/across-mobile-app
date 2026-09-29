export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.atlxpres.com";
export const TOKEN_KEY = "across.accessToken";
export const EXPIRY_KEY = "across.accessTokenExpiresAt";
export const CART_KEY = "across.cart.v1";
export const PENDING_PAYMENT_KEY = "across.pendingPayment.v1";
export const LOGO = require("../assets/atlantic-express-logo.png");
export const FLUTTERWAVE_LOGO = require("../assets/Flutterwave_Logo.png");
export const AUTH_TIMEOUT_MS = Number.parseInt(process.env.EXPO_PUBLIC_AUTH_TIMEOUT_MS || "12000", 10);

export const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=700&q=70",
  "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=700&q=70",
  "https://images.unsplash.com/photo-1601524909162-ae8725290836?auto=format&fit=crop&w=700&q=70"
];

export const INTERNATIONAL_TRACKING_STAGES = [
  "Order Placed","Seller Processing","Dispatched from Origin",
  "In Transit Internationally","Arrived at Local Hub",
  "Out for Delivery / Ready for Pickup","Delivered"
] as const;

export const LOCAL_TRACKING_STAGES = [
  "Order Placed","Seller Confirmed","Preparing Order",
  "Ready for Pickup / Delivery","Out for Delivery / Ready for Pickup","Delivered"
] as const;

export const BOTTOM_NAV_HEIGHT = 58;
export const defaultCategories = ["All","Mobile Devices","Laptops","Accessories",
  "Male Clothes","Female Clothes","Shoes","Beauty","Home","Electronics","Kids"];
