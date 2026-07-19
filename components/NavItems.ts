import { Ionicons } from "@expo/vector-icons";
import { Tab } from "./types";

export const NAV_ITEMS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  { key: "cart", label: "Cart", icon: "cart-outline", activeIcon: "cart" },
  { key: "account", label: "Account", icon: "person-outline", activeIcon: "person" },
  { key: "track", label: "Track", icon: "airplane-outline", activeIcon: "airplane" },
  { key: "support", label: "Support", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" }
];
