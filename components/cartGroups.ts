import type { CartItem, Product } from './types';

export function cartGroupKey(product: Product): string {
  return `${product.provider_id || ''}:${product.fulfillment_mode || ''}:${product.currency}`;
}

export function groupCart(items: CartItem[]) {
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const key = cartGroupKey(item.product);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups].map(([key, entries]) => ({ key, items: entries }));
}

export function removePurchasedItems(items: CartItem[], purchased: { product_id: string; quantity: number }[]): CartItem[] {
  const quantities = new Map(purchased.map(item => [item.product_id, item.quantity]));
  return items.flatMap(item => {
    const quantity = Math.max(0, item.quantity - (quantities.get(item.product.id) || 0));
    return quantity ? [{ ...item, quantity }] : [];
  });
}
