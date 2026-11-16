import {postMediaError, type PostPolicy, type ProviderPost} from './providerPublishingPolicy';

export function listingStepForField(kind: 'products' | 'listings', field: string) {
  if (['images', 'videos'].includes(field)) return 2;
  const location = ['currency_code', 'location', 'city', 'state', 'address_line', 'country_code', 'capacity', 'contact_email', 'contact_phone', 'service_radius_km', 'inventory_city', 'inventory_country_code', 'inventory_location', 'fulfillment_mode', 'stock_state', 'delivery_methods', 'delivery_areas', 'delivery_times'];
  return location.includes(field) ? 1 : 0;
}

// Step guidance only. The unchanged complete policy runs again before every write.
export function listingStepErrors(kind: 'products' | 'listings', draft: ProviderPost, policy: PostPolicy, confirmed: boolean, step: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = (key: string, label: string) => {if (!String(draft[key] || '').trim()) errors[key] = label;};
  if (step === 0) {
    required('title', 'Enter a name for this listing.'); required('description', 'Describe what the customer will get.');
    if (kind === 'products') {
      if (!draft.category_path?.length || draft.category_path.some((value: unknown) => typeof value !== 'string' || !value.trim())) errors.category_path = 'Choose or enter a product category.';
      if (!Number.isFinite(draft.local_selling_price) || draft.local_selling_price <= 0) errors.local_selling_price = 'Enter a selling price greater than zero.';
      if (!Number.isInteger(draft.inventory_count) || draft.inventory_count < 0) errors.inventory_count = 'Enter a whole-number stock quantity.';
      if (draft.compare_at_price !== null && (!Number.isFinite(draft.compare_at_price) || draft.compare_at_price <= draft.local_selling_price)) errors.compare_at_price = 'Original price must be higher than the selling price.';
    } else {
      required('category', 'Choose a service category.');
      const mode = draft.attributes?.price_mode;
      if (mode !== 'quote' && (draft.price === null || !Number.isFinite(draft.price) || draft.price < 0 || mode === 'from' && draft.price <= 0)) errors.price = 'Enter a valid price for this service.';
    }
  }
  if (step === 1) {
    if (kind === 'products') {
      required('inventory_location', 'Enter the stock address or area.'); required('inventory_city', 'Enter the stock city.');
      if (!draft.delivery_methods?.length) errors.delivery_methods = 'Choose delivery, pickup, or both.';
      if (!draft.delivery_areas?.length) errors.delivery_areas = 'Add at least one delivery area.';
    } else {required('city', 'Enter the service city.'); required('state', 'Enter the state / region.');}
    const lat = kind === 'products' ? draft.inventory_latitude : draft.latitude, lon = kind === 'products' ? draft.inventory_longitude : draft.longitude;
    if ((kind === 'listings' || draft.fulfillment_mode === 'merchant_local') && (!confirmed || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) errors.location = 'Capture and confirm the actual service or stock location.';
  }
  if (step === 2) {
    const media = postMediaError(policy, kind === 'products' ? draft.image_urls || [] : draft.media_urls || [], kind === 'products' ? draft.video_urls || [] : draft.attributes?.video_urls || [], draft._retained_images || [], draft._retained_videos || []);
    if (media) errors[media.toLowerCase().includes('video') ? 'videos' : 'images'] = media;
  }
  return errors;
}
