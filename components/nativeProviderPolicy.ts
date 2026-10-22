export type ProviderAccount = {
  id: string; business_name: string; verification_status: string; verification_notes?: string;
  is_active: boolean; is_driver?: boolean; contact_email?: string; contact_phone?: string;
  can_sell_products?: boolean; can_offer_services?: boolean;
  provider_identity?: {avatar_url?: string; banner_url?: string; tier?: string};
  subscription?: {status: string; current_period_end?: string; billing_mode?: string};
};
export const verificationKinds = [
  ['government_id', 'Government ID'], ['business_registration', 'Business registration'],
  ['professional_license', 'Professional qualification'], ['property_authority', 'Property authority'],
  ['address_proof', 'Proof of address'], ['drivers_license', 'Driver licence'],
  ['driver_vehicle', 'Car / vehicle'], ['driver_plate', 'Plate number'],
] as const;
export function hasPaidProviderAccess(provider: ProviderAccount, now = Date.now()) {
  const end = Date.parse(provider.subscription?.current_period_end || '');
  return provider.subscription?.status === 'active' && Number.isFinite(end) && end > now;
}
export function verificationImageError(mime: string, bytes: number) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return 'Choose a JPG, PNG or WebP photo.';
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) return 'Choose a clear photo no larger than 10 MB.';
  return '';
}
export function nativeProviderView(route: string) {
  const query = new URLSearchParams(route);
  const view = query.get('view') || 'overview';
  // Preserve deep links into tools that have not migrated; never silently land elsewhere.
  if (['conversation', 'shared', 'hall', 'ticket', 'event', 'notification'].some(key => query.has(key))) return 'legacy';
  return ['overview', 'verification', 'subscription', 'products', 'listings'].includes(view) ? view : 'legacy';
}
