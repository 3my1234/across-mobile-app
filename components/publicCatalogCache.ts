import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL} from './config';
import type {Product} from './types';

const KEY = 'across.public-catalog.v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_CHARACTERS = 128 * 1024;
let writes: Promise<unknown> = Promise.resolve();

// One bounded public presentation snapshot, never session, cart or payment data.
function publicProduct(product: Product): Product {
  const fields: (keyof Product)[] = ['id', 'sku', 'title', 'description', 'category_path', 'image_urls',
    'currency', 'price', 'updated_at', 'catalog_version', 'delivery_fee', 'compare_at_price',
    'inventory_count', 'is_flash_sale', 'flash_sale_price', 'review_count', 'sold_count',
    'average_rating', 'payment_mode', 'provider_id', 'provider_name', 'fulfillment_mode',
    'inventory_country_code', 'inventory_city', 'stock_state', 'handling_time_hours',
    'delivery_min_days', 'delivery_max_days'];
  const result = Object.fromEntries(fields.map(key => [key, product[key]])) as Product;
  result.origin_hub = {id: product.origin_hub?.id || '', name: product.origin_hub?.name || '', city: product.origin_hub?.city || ''};
  if (product.provider_identity) {
    const p = product.provider_identity;
    result.provider_identity = {id: p.id, name: p.name, avatar_url: p.avatar_url, banner_url: p.banner_url,
      verified: p.verified, paid_active: p.paid_active, tier: p.tier, label: p.label};
  }
  return result;
}

export async function readPublicCatalog(destination: string, now = Date.now()): Promise<Product[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw || raw.length > MAX_CHARACTERS) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.api !== API_URL || value.destination !== destination ||
      !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt > MAX_AGE ||
      !Array.isArray(value.products) || value.products.length > 80) return null;
    if (!value.products.every((p: Product) => p && typeof p.id === 'string' && typeof p.sku === 'string' &&
      typeof p.title === 'string' && typeof p.currency === 'string' &&
      [p.price, p.inventory_count, p.review_count, p.sold_count, p.average_rating].every(Number.isFinite) && Array.isArray(p.image_urls) &&
      p.image_urls.every(url => typeof url === 'string') && Array.isArray(p.category_path) &&
      p.category_path.every(category => typeof category === 'string'))) return null;
    return value.products.map(publicProduct);
  } catch { return null; }
}

export function writePublicCatalog(destination: string, products: Product[], now = Date.now()): Promise<void> {
  writes = writes.catch(() => {}).then(async () => {
    const raw = JSON.stringify({version: 1, api: API_URL, destination, savedAt: now, products: products.slice(0, 80).map(publicProduct)});
    if (raw.length <= MAX_CHARACTERS) await AsyncStorage.setItem(KEY, raw);
    else await AsyncStorage.removeItem(KEY);
  }).catch(() => {}); // Cache/storage failure must never fail a successful feed request.
  return writes as Promise<void>;
}
