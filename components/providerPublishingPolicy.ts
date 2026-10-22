export type PostPolicy = {post_limit: number; max_images: number; max_videos: number; max_video_seconds: number; town_hall: boolean; visibility: string};
export type ProviderPost = Record<string, any>;
export const serviceTypes = ['hotel', 'short_let', 'car_rental', 'car_wash', 'mechanic', 'plumber', 'carpenter', 'fuel_station', 'food_vendor', 'artisan', 'shop_rental', 'property', 'land'];
export function postMediaError(policy: PostPolicy, images: string[], videos: string[]) {
  if (!Number.isInteger(policy.max_images) || policy.max_images < 1 || !Number.isInteger(policy.max_videos) || policy.max_videos < 0) return 'Your plan limits are unavailable. Refresh before saving.';
  if (images.length < 1) return 'Add at least one clear image.';
  if (images.length > policy.max_images) return `Your plan allows ${policy.max_images} image(s) per post. Remove images or upgrade.`;
  if (videos.length > policy.max_videos) return 'Your plan does not allow this many videos. Remove videos or upgrade.';
  return '';
}
export function makeServiceDraft(provider: ProviderPost): ProviderPost {
  return {listing_type: 'artisan', title: '', description: '', category: '', contact_email: provider.contact_email || '', contact_phone: provider.contact_phone || '', address_line: '', city: provider.city || '', state: provider.state || '', country_code: provider.country_code || 'NG', currency_code: 'NGN', pricing_unit: '', price: null, capacity: 1, media_urls: [], attributes: {price_mode: 'quote', price_notes: '', video_urls: []}, latitude: null, longitude: null, service_radius_km: 25, is_mobile_service: false, is_available_now: false};
}
export function validatePostDraft(kind: 'listings' | 'products', draft: ProviderPost, policy: PostPolicy, confirmedLocation: boolean) {
  const media = postMediaError(policy, kind === 'listings' ? draft.media_urls : draft.image_urls, kind === 'listings' ? draft.attributes?.video_urls || [] : draft.video_urls || []);
  if (media) throw new Error(media);
  for (const field of ['title', 'description']) if (!String(draft[field] || '').trim()) throw new Error('Enter a title and description.');
  const lat = kind === 'listings' ? draft.latitude : draft.inventory_latitude, lon = kind === 'listings' ? draft.longitude : draft.inventory_longitude;
  if ((kind === 'listings' || draft.fulfillment_mode === 'merchant_local') && (!confirmedLocation || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)) throw new Error('Capture and confirm the actual service or stock location.');
  if (kind === 'listings') {
    if (!serviceTypes.includes(draft.listing_type)) throw new Error('Choose a supported service type.');
    if (!String(draft.city || '').trim() || !String(draft.category || '').trim() || !String(draft.state || '').trim()) throw new Error('Enter the service category, city and state / region.');
    if (!/^[A-Z]{2}$/.test(draft.country_code)) throw new Error('Enter a two-letter service country code.');
    // The deployed list endpoint omits contacts. Never silently clear hidden fields on PATCH.
    if (draft.id && (!Object.prototype.hasOwnProperty.call(draft, 'contact_email') || !Object.prototype.hasOwnProperty.call(draft, 'contact_phone'))) throw new Error('The server did not return the complete editable service. Open existing tools until the full-detail API is available.');
    if (!Number.isInteger(draft.capacity) || draft.capacity < 1) throw new Error('Capacity must be a positive whole number.');
    if (draft.price !== null && (!Number.isFinite(draft.price) || draft.price < 0)) throw new Error('Enter a valid price.');
    if (draft.attributes.price_mode === 'from' && !(draft.price > 0)) throw new Error('Starting price must be greater than zero.');
    if (draft.attributes.price_mode === 'fixed' && draft.price === null) throw new Error('Enter your fixed price.');
    if (draft.service_radius_km !== null && (!Number.isFinite(draft.service_radius_km) || draft.service_radius_km <= 0 || draft.service_radius_km > 500)) throw new Error('Service radius must be between 0 and 500 km.');
  } else {
    if (!Number.isFinite(draft.local_selling_price) || draft.local_selling_price <= 0 || !Number.isInteger(draft.inventory_count) || draft.inventory_count < 0) throw new Error('Enter a positive price and a whole-number stock quantity.');
    if (!Array.isArray(draft.delivery_areas) || !draft.delivery_areas.length) throw new Error('Add at least one delivery area.');
    if (!/^[A-Z]{2}$/.test(draft.inventory_country_code) || !String(draft.inventory_city || '').trim()) throw new Error('Enter a two-letter stock country and stock city.');
    if (![draft.handling_time_hours, draft.delivery_min_days, draft.delivery_max_days].every(Number.isInteger) || draft.handling_time_hours < 0 || draft.delivery_min_days < 0 || draft.delivery_max_days < draft.delivery_min_days) throw new Error('Enter valid whole-number handling and delivery times.');
  }
  if (!/^[A-Z]{3}$/.test(draft.currency_code)) throw new Error('Enter a three-letter currency code.');
}
export function makeProductDraft(provider: ProviderPost): ProviderPost {
  return {payment_mode: 'contact', title: '', description: '', sku: '', category_path: [], image_urls: [], video_urls: [], local_selling_price: 0, currency_code: 'NGN', compare_at_price: null, flash_sale_price: null, is_flash_sale: false, inventory_count: 1, fulfillment_mode: 'merchant_local', inventory_country_code: provider.country_code || 'NG', inventory_city: provider.city || '', inventory_location: '', inventory_latitude: null, inventory_longitude: null, stock_state: 'locally_available', handling_time_hours: 24, delivery_min_days: 1, delivery_max_days: 7, delivery_methods: ['delivery'], delivery_areas: [], return_policy: '', atlantic_last_mile: false};
}
export function postPayload(kind: 'listings' | 'products', draft: ProviderPost): ProviderPost {
  // Keep all fetched write fields, including delivery offers, videos, attributes,
  // sale terms and geolocation; never rebuild PATCH from only visible inputs.
  const payload = JSON.parse(JSON.stringify(draft));
  if (kind === 'listings' && payload.attributes.price_mode === 'quote') payload.price = null;
  if (kind === 'products') {payload.payment_mode = 'contact'; payload.atlantic_last_mile = false;}
  return payload;
}
