export type ProviderAccount = {
  id: string; business_name: string; verification_status: string; verification_notes?: string;
  is_active: boolean; is_driver?: boolean; contact_email?: string; contact_phone?: string;
  can_sell_products?: boolean; can_offer_services?: boolean;
  description?: string; website_url?: string; address_line?: string; city?: string; state?: string; country_code?: string;
  provider_identity?: {avatar_url?: string; banner_url?: string; tier?: string};
  subscription?: {status: string; current_period_end?: string; billing_mode?: string; billing_provider?: 'flutterwave' | 'google_play'};
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
export function verificationFileError(kind: string, mime: string, bytes: number) {
  if (['drivers_license', 'driver_vehicle', 'driver_plate'].includes(kind)) return verificationImageError(mime, bytes);
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime)) return 'Choose a PDF, JPG, PNG or WebP document.';
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) return 'Choose a document no larger than 10 MB.';
  return '';
}
export function privateDocumentPreviewURL(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('A secure document preview is unavailable. Refresh and retry.');
  return url.href;
}
export function nativeProviderView(route: string) {
  const query = new URLSearchParams(route);
  const view = query.get('view') || 'overview';
  // Reject malformed or ambiguous destinations instead of showing unrelated data.
  if (query.has('ticket') && (view !== 'support' || !validProviderID(query.get('ticket')))) return 'legacy';
  if (view === 'support' && ['conversation', 'shared', 'hall'].some(key => query.has(key))) return 'legacy';
  if (['conversation', 'shared', 'hall'].some(key => query.has(key))) return ['conversation', 'shared', 'hall'].every(key => !query.has(key) || validProviderID(query.get(key))) ? 'messages' : 'legacy';
  if (['event', 'notification'].some(key => query.has(key) && !validProviderID(query.get(key)))) return 'legacy';
  if (query.has('request') && (view !== 'requests' || !validProviderID(query.get('request')))) return 'legacy';
  return ['overview', 'notifications', 'profile', 'verification', 'subscription', 'products', 'listings', 'messages', 'support', 'driver', 'requests', 'merchant-orders'].includes(view) ? view : 'legacy';
}
export function providerRouteContext(route: string) {
  const query = new URLSearchParams(route), id = (key: string) => validProviderID(query.get(key)) ? query.get(key)! : '';
  return {event: id('event'), notification: id('notification'), request: id('request')};
}
export function providerSupportTicket(route: string) {
  if (nativeProviderView(route) !== 'support') return undefined;
  const value = new URLSearchParams(route).get('ticket');
  return validProviderID(value) ? value! : undefined;
}
const validProviderID = (value: string | null) => Boolean(value && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value));
export function providerMessageDestination(route: string) {
  const query = new URLSearchParams(route), id = (key: string) => validProviderID(query.get(key)) ? query.get(key)! : '';
  return {conversation: id('shared') || id('conversation'), hall: id('hall'), event: id('event'), mode: id('hall') || query.get('mode') === 'town-hall' ? 'town-hall' as const : 'chats' as const};
}
