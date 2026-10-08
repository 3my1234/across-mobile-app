import type { CartItem, Product } from "./types";

export function latestProductSnapshot(previous: Product | undefined, incoming: Product): Product {
  if (!previous) return incoming;
  const oldTime = Date.parse(previous.updated_at || "") || 0;
  const newTime = Date.parse(incoming.updated_at || "") || 0;
  if (oldTime > newTime || (oldTime === newTime && (previous.catalog_version || 0) > (incoming.catalog_version || 0))) return previous;
  return incoming;
}

export function reconcileCart(items: CartItem[], snapshots: Map<string, Product>, unavailable: Set<string>): CartItem[] {
  return items.flatMap(entry => {
    if (unavailable.has(entry.product.id)) return [];
    const incoming = snapshots.get(entry.product.id);
    const product = incoming ? latestProductSnapshot(entry.product, incoming) : entry.product;
    if (product.payment_mode==="contact") return [];
    const quantity = Math.min(entry.quantity, product.inventory_count);
    return quantity > 0 ? [{ product, quantity }] : [];
  });
}

export function cartOfferFingerprint(items: CartItem[]): string {
  return items.map(item => [item.product.id, item.quantity, item.product.currency, item.product.price, item.product.delivery_fee, item.product.fulfillment_mode,item.product.payment_mode].join(":")).sort().join("|");
}
