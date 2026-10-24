export type PostPolicy = {post_limit: number; max_images: number; max_videos: number; max_video_seconds: number; town_hall: boolean; visibility: string};
export type ProviderPost = Record<string, any>;
export function providerVideoPreviewURL(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('This video preview is unavailable. Refresh the post before trying again.');
  return url.href;
}
export function deliveryAreaPayload(form: {country: string; state: string; city: string; currency: string; fee: string; itemPrice: string; primary: boolean; confirmed: boolean}, product: ProviderPost) {
  const country = form.country.trim().toUpperCase(), currency = form.currency.trim().toUpperCase();
  const state = form.state.trim().toLowerCase().replace(/\s+/g, ' '), city = form.city.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency) || city && !state || state.length > 100 || city.length > 100) throw Error('Enter a two-letter delivery country and three-letter currency. A city also needs a state.');
  const fee = Number(form.fee), price = form.primary ? product.local_selling_price : Number(form.itemPrice);
  if (!form.fee.trim() || !Number.isFinite(fee) || fee < 0 || !Number.isFinite(price) || price <= 0 || !form.primary && !form.itemPrice.trim()) throw Error('Enter a positive item price and a delivery fee of zero or more.');
  if (form.primary && currency !== product.currency_code) throw Error('A delivery offer linked to the main price must use the same currency.');
  if (!form.primary && !form.confirmed) throw Error('Confirm the independent destination item price before adding this offer.');
  if ((product.delivery_areas || []).length >= 20) throw Error('A product supports up to 20 delivery areas.');
  if ((product.delivery_areas || []).some((area: ProviderPost) => area.country_code?.toUpperCase() === country && String(area.state || '').trim().toLowerCase().replace(/\s+/g, ' ') === state && String(area.city || '').trim().toLowerCase().replace(/\s+/g, ' ') === city)) throw Error('This delivery area already exists. Remove its old offer first.');
  return {country_code: country, state, city, currency_code: currency, item_price: price, delivery_fee: fee, delivered_price: Math.round((price + fee) * 100) / 100, uses_primary_price: form.primary, independent_price_confirmed: !form.primary && form.confirmed};
}
export function editablePostSnapshot(kind: 'listings' | 'products', snapshot: ProviderPost, expectedID: string): ProviderPost {
  if (!snapshot || snapshot.id !== expectedID) throw new Error('The server returned a different post. Refresh your posts before editing.');
  if (kind === 'listings' && ['contact_email', 'contact_phone', 'attributes', 'media_urls'].some(key => !Object.prototype.hasOwnProperty.call(snapshot, key))) throw new Error('The server did not return the complete editable service. Refresh or contact Support; your saved post has not been changed.');
  if (snapshot.status === 'archived' || snapshot.moderation_status === 'archived') throw new Error('This post has been archived. Refresh your posts.');
  const editable = JSON.parse(JSON.stringify(snapshot));
  if (kind === 'listings' && !['fixed', 'from', 'quote'].includes(editable.attributes?.price_mode)) editable.attributes = {...editable.attributes, price_mode: editable.price == null ? 'quote' : 'fixed'};
  return editable;
}
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
export class PostDraftValidationError extends Error {
  constructor(public field: string, message: string) {super(message); this.name = 'PostDraftValidationError';}
}
export function postDraftErrors(kind: 'listings' | 'products', draft: ProviderPost, policy: PostPolicy, confirmed: boolean): Record<string, string> {
  try {validatePostDraft(kind, draft, policy, confirmed); return {};}
  catch (error) {return {[error instanceof PostDraftValidationError ? error.field : 'form']: error instanceof Error ? error.message : 'Please check this listing.'};}
}
export function validatePostDraft(kind: 'listings' | 'products', draft: ProviderPost, policy: PostPolicy, confirmedLocation: boolean) {
  const media = postMediaError(policy, kind === 'listings' ? draft.media_urls || [] : draft.image_urls || [], kind === 'listings' ? draft.attributes?.video_urls || [] : draft.video_urls || []);
  if (media) throw new PostDraftValidationError(media.toLowerCase().includes('video') ? 'videos' : 'images', media);
  for (const field of ['title', 'description']) if (!String(draft[field] || '').trim()) throw new PostDraftValidationError(field, field === 'title' ? 'Enter a name for this listing.' : 'Describe what you are offering.');
  const lat = kind === 'listings' ? draft.latitude : draft.inventory_latitude, lon = kind === 'listings' ? draft.longitude : draft.inventory_longitude;
  if ((kind === 'listings' || draft.fulfillment_mode === 'merchant_local') && (!confirmedLocation || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)) throw new PostDraftValidationError('location', 'Capture and confirm the actual service or stock location.');
  if (kind === 'listings') {
    if (!serviceTypes.includes(draft.listing_type)) throw new PostDraftValidationError('listing_type', 'Choose a supported service type.');
    if (!String(draft.city || '').trim() || !String(draft.category || '').trim() || !String(draft.state || '').trim()) throw new PostDraftValidationError(!String(draft.category || '').trim() ? 'category' : !String(draft.city || '').trim() ? 'city' : 'state', 'Enter the service category, city and state / region.');
    if (!/^[A-Z]{2}$/.test(draft.country_code)) throw new PostDraftValidationError('country_code', 'Enter a two-letter service country code.');
    // The deployed list endpoint omits contacts. Never silently clear hidden fields on PATCH.
    if (draft.id && (!Object.prototype.hasOwnProperty.call(draft, 'contact_email') || !Object.prototype.hasOwnProperty.call(draft, 'contact_phone'))) throw new PostDraftValidationError('form', 'The server did not return the complete editable service. Open existing tools until the full-detail API is available.');
    if (!Number.isInteger(draft.capacity) || draft.capacity < 1) throw new PostDraftValidationError('capacity', 'Capacity must be a positive whole number.');
    if (draft.price !== null && (!Number.isFinite(draft.price) || draft.price < 0)) throw new PostDraftValidationError('price', 'Enter a valid price.');
    if (draft.attributes.price_mode === 'from' && !(draft.price > 0)) throw new PostDraftValidationError('price', 'Starting price must be greater than zero.');
    if (draft.attributes.price_mode === 'fixed' && draft.price === null) throw new PostDraftValidationError('price', 'Enter your fixed price.');
    if (draft.service_radius_km !== null && (!Number.isFinite(draft.service_radius_km) || draft.service_radius_km <= 0 || draft.service_radius_km > 500)) throw new PostDraftValidationError('service_radius_km', 'Service radius must be between 0 and 500 km.');
  } else {
    if (!['merchant_local', 'merchant_cross_border'].includes(draft.fulfillment_mode)) throw new PostDraftValidationError('fulfillment_mode', 'Choose the stock fulfillment route.');
    if (draft.fulfillment_mode === 'merchant_local' ? draft.stock_state !== 'locally_available' : !['foreign_stock', 'import_on_demand'].includes(draft.stock_state)) throw new PostDraftValidationError('stock_state', 'Choose a stock state that matches the fulfillment route.');
    if (!String(draft.inventory_location || '').trim()) throw new PostDraftValidationError('inventory_location', 'Enter the actual stock address or area.');
    if (!Array.isArray(draft.category_path) || !draft.category_path.length || draft.category_path.some((part: unknown) => typeof part !== 'string' || !part.trim())) throw new PostDraftValidationError('category_path', 'Enter a product category.');
    if (!Array.isArray(draft.delivery_methods) || !draft.delivery_methods.length || draft.delivery_methods.some((method: string) => !['delivery', 'pickup'].includes(method))) throw new PostDraftValidationError('delivery_methods', 'Choose delivery, pickup, or both.');
    if (draft.compare_at_price !== null && (!Number.isFinite(draft.compare_at_price) || draft.compare_at_price <= draft.local_selling_price)) throw new PostDraftValidationError('compare_at_price', 'Crossed-out price must be higher than the selling price.');
    if (draft.is_flash_sale && (!Number.isFinite(draft.flash_sale_price) || draft.flash_sale_price <= 0 || draft.flash_sale_price >= draft.local_selling_price)) throw new PostDraftValidationError('flash_sale_price', 'Flash sale price must be positive and lower than the selling price.');
    if (!Number.isFinite(draft.local_selling_price) || draft.local_selling_price <= 0 || !Number.isInteger(draft.inventory_count) || draft.inventory_count < 0) throw new PostDraftValidationError(!Number.isFinite(draft.local_selling_price) || draft.local_selling_price <= 0 ? 'local_selling_price' : 'inventory_count', 'Enter a positive price and a whole-number stock quantity.');
    if (!Array.isArray(draft.delivery_areas) || !draft.delivery_areas.length) throw new PostDraftValidationError('delivery_areas', 'Add at least one delivery area.');
    if (!/^[A-Z]{2}$/.test(draft.inventory_country_code) || !String(draft.inventory_city || '').trim()) throw new PostDraftValidationError(!/^[A-Z]{2}$/.test(draft.inventory_country_code) ? 'inventory_country_code' : 'inventory_city', 'Enter a two-letter stock country and stock city.');
    if (![draft.handling_time_hours, draft.delivery_min_days, draft.delivery_max_days].every(Number.isInteger) || draft.handling_time_hours < 0 || draft.delivery_min_days < 0 || draft.delivery_max_days < draft.delivery_min_days) throw new PostDraftValidationError('delivery_times', 'Enter valid whole-number handling and delivery times.');
  }
  if (!/^[A-Z]{3}$/.test(draft.currency_code)) throw new PostDraftValidationError('currency_code', 'Enter a three-letter currency code.');
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
